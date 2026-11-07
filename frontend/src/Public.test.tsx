import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReportPage, Landing } from "./Public";
import { Login } from "./Auth";
vi.mock("./Map", () => ({ Map: () => null }));
function mount(node: React.ReactNode) {
  return render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <MemoryRouter>{node}</MemoryRouter>
    </QueryClientProvider>,
  );
}
afterEach(() => vi.unstubAllGlobals());
describe("Public workflows", () => {
  it("offers reporting without requiring sign in", () => {
    mount(<Landing />);
    expect(
      screen.getByRole("link", { name: /Report an emergency/ }),
    ).toHaveAttribute("href", "/report");
  });
  it("validates emergency detail before contacting backend", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    mount(<ReportPage />);
    fireEvent.click(
      screen.getByRole("button", { name: /Submit emergency report/ }),
    );
    await waitFor(() => expect(screen.getAllByRole("alert")).toHaveLength(2));
    expect(fetch).not.toHaveBeenCalled();
  });
  it("does not claim that unconfigured Google authentication works", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue({
          ok: true,
          json: async () => ({ google: false, email: true }),
        }),
    );
    mount(<Login />);
    await screen.findByText(
      "Google Sign-In is not configured for this deployment.",
    );
    expect(
      screen.getByText("Continue with Google").closest("a"),
    ).toHaveAttribute("aria-disabled", "true");
  });
  it("shows server errors instead of a success screen", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue({
          ok: false,
          status: 503,
          json: async () => ({ detail: "Reporting service unavailable" }),
        }),
    );
    mount(<ReportPage />);
    fireEvent.change(screen.getByLabelText("What is happening?"), {
      target: { value: "A clear emergency description" },
    });
    fireEvent.change(screen.getByLabelText("Address or nearby landmark"), {
      target: { value: "A known location" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: /Submit emergency report/ }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Reporting service unavailable",
    );
  });
});
