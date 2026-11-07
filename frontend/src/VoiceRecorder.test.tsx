import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReportPage } from "./Public";

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

describe("Voice Reporting Integration", () => {
  it("allows switching to Voice Report mode", async () => {
    mount(<ReportPage />);
    const voiceTab = screen.getByRole("button", { name: /Voice Report/ });
    fireEvent.click(voiceTab);

    expect(
      screen.getByText("AI Emergency Voice Reporting"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Start Recording/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("combobox"),
    ).toHaveValue("auto");
  });

  it("handles microphone permission denial gracefully", async () => {
    const error = new Error("Permission denied");
    error.name = "NotAllowedError";

    vi.stubGlobal("navigator", {
      ...navigator,
      mediaDevices: {
        getUserMedia: vi.fn().mockRejectedValue(error),
      },
    });

    mount(<ReportPage />);
    fireEvent.click(screen.getByRole("button", { name: /Voice Report/ }));
    fireEvent.click(screen.getByRole("button", { name: /Start Recording/ }));

    await waitFor(() => {
      expect(
        screen.getByText(/Microphone permission was denied/),
      ).toBeInTheDocument();
    });
  });

  it("shows unsupported browser message when mediaDevices is missing", async () => {
    vi.stubGlobal("navigator", {
      ...navigator,
      mediaDevices: undefined,
    });

    mount(<ReportPage />);
    fireEvent.click(screen.getByRole("button", { name: /Voice Report/ }));
    fireEvent.click(screen.getByRole("button", { name: /Start Recording/ }));

    await waitFor(() => {
      expect(
        screen.getByText(/Microphone access is not supported by this browser/),
      ).toBeInTheDocument();
    });
  });
});

