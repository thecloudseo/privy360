import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import console from "node:console";
import process from "node:process";

const root = resolve(import.meta.dirname, "..");
const images = JSON.parse(
  await readFile(resolve(root, "infra/docker/security/images.json"), "utf8"),
).images;
const image = images.keycloak.image;
const digest = image.split("@sha256:")[1];
const jarPath =
  "/opt/keycloak/lib/lib/main/com.microsoft.sqlserver.mssql-jdbc-13.2.1.jre11.jar";
const rpmPath = "/var/lib/rpm/rpmdb.sqlite";
const published =
  "https://repo.maven.apache.org/maven2/com/microsoft/sqlserver/mssql-jdbc/13.2.1.jre11/mssql-jdbc-13.2.1.jre11.jar.sha256";
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
function run(binary, args, timeout = 30_000) {
  const result = spawnSync(binary, args, {
    cwd: root,
    encoding: "utf8",
    timeout,
    maxBuffer: 5 * 1024 * 1024,
  });
  if (result.error || result.status !== 0)
    throw new Error(
      `${binary} failed (${result.status ?? result.error?.code}); provenance not published.`,
    );
  return result.stdout.trim();
}

const temp = await mkdtemp(resolve(root, ".cache/keycloak-provenance-"));
let container;
try {
  const inspected = JSON.parse(run("docker", ["image", "inspect", image]));
  if (
    inspected.length !== 1 ||
    !inspected[0].RepoDigests?.includes(image) ||
    inspected[0].Architecture !== "amd64" ||
    inspected[0].Os !== "linux"
  )
    throw new Error("Exact Keycloak image digest/platform was not verified.");
  container = run("docker", [
    "create",
    "--platform",
    "linux/amd64",
    "--network",
    "none",
    "--entrypoint",
    "/bin/sh",
    image,
  ]);
  const jarFile = resolve(temp, "mssql-jdbc.jar");
  const rpmFile = resolve(temp, "rpmdb.sqlite");
  run("docker", ["cp", `${container}:${jarPath}`, jarFile]);
  run("docker", ["cp", `${container}:${rpmPath}`, rpmFile]);
  const jarHash = sha(await readFile(jarFile));
  const rpmHash = sha(await readFile(rpmFile));
  const fixedHash = run("curl", [
    "--fail",
    "--silent",
    "--show-error",
    "--location",
    "--max-time",
    "30",
    published,
  ]);
  if (!/^[a-f0-9]{64}$/.test(fixedHash) || jarHash !== fixedHash)
    throw new Error(
      "Image JDBC JAR does not match Maven Central's fixed artifact checksum.",
    );
  const pom = run("unzip", [
    "-p",
    jarFile,
    "META-INF/maven/com.microsoft.sqlserver/mssql-jdbc/pom.properties",
  ]);
  const sql =
    "select Name.key||'|'||Basenames.key from Name join Basenames using(hnum) where Name.key in ('pcre2','pcre2-syntax') order by Name.key,Basenames.key;";
  const files = run("sqlite3", [rpmFile, sql]).split("\n");
  const dirs = run("sqlite3", [
    rpmFile,
    "select Name.key||'|'||Dirnames.key from Name join Dirnames using(hnum) where Name.key in ('pcre2','pcre2-syntax') order by Name.key,Dirnames.key;",
  ]).split("\n");
  if (
    !files.some((x) => x.includes("pcre2|libpcre2-8.so")) ||
    files.some((x) => x.startsWith("pcre2-syntax|") && /\.so(?:\.|$)/.test(x))
  )
    throw new Error(
      "PCRE2 package-content evidence differs from reviewed expectation.",
    );
  const record = {
    schemaVersion: 1,
    image,
    digest,
    platform: "linux/amd64",
    verifiedAt: new Date().toISOString(),
    jdbc: {
      path: jarPath,
      sha256: jarHash,
      publishedFixedVersion: "13.2.1.jre11",
      publishedChecksumUrl: published,
      publishedSha256: fixedHash,
      embeddedPomProperties: pom,
    },
    pcre2: {
      rpmDatabasePath: rpmPath,
      rpmDatabaseSha256: rpmHash,
      packageBasenames: files,
      packageDirectories: dirs,
      conclusion:
        "pcre2 has shared libraries; pcre2-syntax has documentation/man-page paths in this RPM database. Shared-library findings remain unresolved.",
    },
  };
  await writeFile(
    resolve(
      root,
      "infra/docker/security/evidence/keycloak-docker-provenance.json",
    ),
    JSON.stringify(record, null, 2) + "\n",
  );
  console.log(
    "Exact digest-linked JDBC and PCRE2 provenance captured for review; no finding was suppressed.",
  );
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  if (container) {
    try {
      run("docker", ["rm", "--force", container]);
    } catch (error) {
      console.error(`Temporary container cleanup failed: ${error.message}`);
      process.exitCode = 1;
    }
  }
  await rm(temp, { recursive: true, force: true });
}
