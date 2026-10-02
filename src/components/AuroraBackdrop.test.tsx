import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import AuroraBackdrop from "./AuroraBackdrop";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("AuroraBackdrop", () => {
  it("keeps the game usable when WebGL is unavailable", () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
    const { container } = render(<AuroraBackdrop phase="menu" reducedMotion={false} />);
    expect(container.querySelector("canvas.webgl-aurora")).toBeInTheDocument();
  });
});
