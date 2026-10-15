import { useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Button, Card, Form, Modal, SelectField, TextField } from "./index.ts";

afterEach(() => {
  cleanup();
});

describe("Button", () => {
  it("renders a non-submitting button by default", () => {
    const { container } = render(<Button>Save</Button>);
    expect(container).toMatchSnapshot();
    expect(screen.getByRole("button", { name: "Save" })).toHaveAttribute(
      "type",
      "button",
    );
  });

  it("is disabled and reports busy while loading", () => {
    render(
      <Button variant="danger" loading>
        Withdraw
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Withdraw" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(button).toHaveClass("p360-button--danger");
  });
});

describe("Card", () => {
  it("labels the section with its heading", () => {
    const { container } = render(
      <Card title="Consents">
        <p>Body</p>
      </Card>,
    );
    expect(container).toMatchSnapshot();
    expect(
      screen.getByRole("region", { name: "Consents" }),
    ).toBeInTheDocument();
  });
});

describe("TextField", () => {
  it("associates label, hint and error with the input", () => {
    const { container } = render(
      <TextField
        label="Data principal ID"
        hint="Opaque identifier"
        error="Required"
        required
      />,
    );
    expect(container).toMatchSnapshot();
    const input = screen.getByLabelText(/Data principal ID/);
    expect(input).toBeRequired();
    expect(input).toHaveAttribute("aria-invalid", "true");
    const describedBy = input.getAttribute("aria-describedby") ?? "";
    expect(describedBy.split(" ")).toHaveLength(2);
    expect(screen.getByRole("alert")).toHaveTextContent("Required");
  });

  it("does not mark a valid field invalid", () => {
    render(<TextField label="Name" />);
    expect(screen.getByLabelText("Name")).not.toHaveAttribute("aria-invalid");
  });
});

describe("SelectField", () => {
  it("renders labelled options", () => {
    const { container } = render(
      <SelectField label="Purpose" defaultValue="marketing">
        <option value="marketing">Marketing</option>
        <option value="analytics">Analytics</option>
      </SelectField>,
    );
    expect(container).toMatchSnapshot();
    expect(screen.getByLabelText("Purpose")).toHaveValue("marketing");
  });
});

describe("Form", () => {
  it("disables native constraint validation and reports busy state", () => {
    render(
      <Form aria-label="Create consent" busy>
        <button type="submit">Create</button>
      </Form>,
    );
    const form = screen.getByRole("form", { name: "Create consent" });
    expect(form).toHaveAttribute("novalidate");
    expect(form).toHaveAttribute("aria-busy", "true");
  });
});

describe("Modal", () => {
  function Harness() {
    const [open, setOpen] = useState(false);
    return (
      <>
        <button onClick={() => setOpen(true)}>Open</button>
        <Modal
          open={open}
          title="Confirm"
          onClose={() => setOpen(false)}
          footer={<button>OK</button>}
        >
          <p>Are you sure?</p>
        </Modal>
      </>
    );
  }

  it("renders nothing while closed and a labelled dialog when open", () => {
    const { container } = render(<Harness />);
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Open" }));
    const dialog = screen.getByRole("dialog", { name: "Confirm" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(container).toMatchSnapshot();
  });

  it("closes on Escape and restores focus to the trigger", () => {
    render(<Harness />);
    const trigger = screen.getByRole("button", { name: "Open" });
    trigger.focus();
    fireEvent.click(trigger);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(trigger).toHaveFocus();
  });

  it("calls onClose exactly once per Escape press", () => {
    const onClose = vi.fn();
    render(
      <Modal open title="Confirm" onClose={onClose}>
        <p>Body</p>
      </Modal>,
    );
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("keeps Tab focus within the dialog", () => {
    render(
      <Modal
        open
        title="Confirm"
        onClose={() => undefined}
        footer={<button>OK</button>}
      >
        <button>Inner</button>
      </Modal>,
    );
    const ok = screen.getByRole("button", { name: "OK" });
    ok.focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(screen.getByRole("button", { name: "Inner" })).toHaveFocus();
  });
});
