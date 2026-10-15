import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConsentPage } from "./ConsentPage.tsx";
import { ConsentApiError, type ConsentApi } from "./consent-api.ts";
import type { Consent } from "./consent-contract.ts";

afterEach(() => {
  cleanup();
});

const consent: Consent = {
  id: "c-1",
  principalId: "principal-123",
  purpose: "marketing",
  status: "granted",
  grantedDate: "2026-10-15T10:30:00Z",
  createdAt: "2026-10-15T10:30:00Z",
};

function fakeApi(overrides: Partial<ConsentApi> = {}): ConsentApi {
  return {
    list: vi
      .fn()
      .mockResolvedValue({ items: [], total: 0, limit: 50, offset: 0 }),
    create: vi.fn().mockResolvedValue(consent),
    ...overrides,
  };
}

describe("ConsentPage", () => {
  it("shows the loading state, then the empty list", async () => {
    render(<ConsentPage api={fakeApi()} />);
    expect(screen.getByText("Loading consents…")).toBeInTheDocument();
    expect(
      await screen.findByText("No consents have been recorded yet."),
    ).toBeInTheDocument();
  });

  it("renders recorded consents as a table with localised purpose labels", async () => {
    render(
      <ConsentPage
        api={fakeApi({
          list: vi.fn().mockResolvedValue({
            items: [consent],
            total: 1,
            limit: 50,
            offset: 0,
          }),
        })}
      />,
    );
    const table = await screen.findByRole("table");
    expect(table).toHaveTextContent("principal-123");
    expect(table).toHaveTextContent("Marketing");
    expect(table).toHaveTextContent("Granted");
  });

  it("creates a consent with trimmed values, then refreshes the list", async () => {
    const create = vi.fn().mockResolvedValue(consent);
    const list = vi
      .fn()
      .mockResolvedValueOnce({ items: [], total: 0, limit: 50, offset: 0 })
      .mockResolvedValueOnce({
        items: [consent],
        total: 1,
        limit: 50,
        offset: 0,
      });
    render(<ConsentPage api={fakeApi({ create, list })} />);
    await screen.findByText("No consents have been recorded yet.");

    fireEvent.change(screen.getByLabelText(/Data principal ID/), {
      target: { value: "  principal-123 " },
    });
    fireEvent.change(screen.getByLabelText(/Purpose/), {
      target: { value: "marketing" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Record consent" }));

    await waitFor(() =>
      expect(create).toHaveBeenCalledWith({
        dataPrincipalId: "principal-123",
        purpose: "marketing",
        grantConsent: true,
      }),
    );
    expect(await screen.findByRole("table")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Consent recorded.");
  });

  it("blocks submission with field errors and never calls the API", async () => {
    const create = vi.fn();
    render(<ConsentPage api={fakeApi({ create })} />);
    await screen.findByText("No consents have been recorded yet.");

    fireEvent.click(screen.getByRole("button", { name: "Record consent" }));

    expect(create).not.toHaveBeenCalled();
    expect(
      screen.getByText("Check the highlighted fields and try again.", {
        selector: "p",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByText("Enter a value for this field."),
    ).not.toHaveLength(0);
  });

  it("shows a generic message on 403 without revealing the reason", async () => {
    const create = vi.fn().mockRejectedValue(new ConsentApiError("forbidden"));
    render(<ConsentPage api={fakeApi({ create })} />);
    await screen.findByText("No consents have been recorded yet.");

    fireEvent.change(screen.getByLabelText(/Data principal ID/), {
      target: { value: "principal-123" },
    });
    fireEvent.change(screen.getByLabelText(/Purpose/), {
      target: { value: "research" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Record consent" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(
      "You don't have access to this in the current workspace.",
    );
    expect(document.body.textContent).not.toMatch(/tenant|permission|role/i);
  });

  it("offers retry after an unavailable list and recovers", async () => {
    const list = vi
      .fn()
      .mockRejectedValueOnce(new ConsentApiError("unavailable"))
      .mockResolvedValueOnce({
        items: [consent],
        total: 1,
        limit: 50,
        offset: 0,
      });
    render(<ConsentPage api={fakeApi({ list })} />);

    const retry = await screen.findByRole("button", { name: "Try again" });
    fireEvent.click(retry);

    expect(await screen.findByRole("table")).toHaveTextContent("principal-123");
    expect(list).toHaveBeenCalledTimes(2);
  });
});
