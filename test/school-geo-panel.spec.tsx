import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import type { TrackerGeoVerification, TrackerGridRow, TrackerTemplate } from "@/lib/tracker-api";

let geoResult: { data: TrackerGeoVerification[] | undefined; isLoading: boolean };
const uploadMutate = vi.fn();
const overrideMutate = vi.fn();
let uploadPending = false;

vi.mock("@/lib/queries/tracker", () => ({
  useTemplateGeoVerifications: () => geoResult,
  useUploadGeoVerification: () => ({ mutateAsync: uploadMutate, isPending: uploadPending }),
  useOverrideGeoVerification: () => ({ mutateAsync: overrideMutate, isPending: false }),
}));

import { SchoolGeoPanel } from "@/app/dashboard/tracker/_components/school-geo-panel";

const template = (over: Partial<TrackerTemplate> = {}): TrackerTemplate =>
  ({
    id: "t1", code: "VISIT", name: "School visit", description: null,
    target_type: "school", completion_style: "checklist", workflow_statuses: null,
    done_status: null, deadline: null, priority: "medium", recurrence_frequency: null,
    require_photo: false, require_location: false, require_geo_verification: true,
    status: "active", ...over,
  }) as TrackerTemplate;

const row = (over: Partial<TrackerGridRow> = {}): TrackerGridRow =>
  ({
    record_id: "r1", status: "not_started", cells: [], blocked: false, blocker: null,
    school_name: "Govt HSS Coimbatore", school_id: "s1", target_name: null,
    lifecycle: "not_started", ...over,
  }) as TrackerGridRow;

const verification = (over: Partial<TrackerGeoVerification> = {}): TrackerGeoVerification => ({
  id: "v1", school_id: "s1", status: "verified", accepted: true,
  distance_m: 34.2, radius_m: 200, accuracy_m: null,
  exif_captured_at: "2026-08-24T04:15:00.000Z",
  uploaded_at: "2026-08-24T09:00:00.000Z",
  preview_url: "https://signed.test/preview.jpg",
  override_by: null, override_at: null, override_reason: null,
  ...over,
});

function renderPanel(props: Partial<React.ComponentProps<typeof SchoolGeoPanel>> = {}) {
  return render(
    <SchoolGeoPanel
      template={template()}
      rows={[row()]}
      schoolFilter=""
      onSchoolFilterChange={() => {}}
      canFill
      {...props}
    />,
  );
}

beforeEach(() => {
  geoResult = { data: [], isLoading: false };
  uploadMutate.mockReset();
  overrideMutate.mockReset();
  uploadPending = false;
});

describe("SchoolGeoPanel — visibility", () => {
  it("renders nothing when the task does not require verification", () => {
    const { container } = renderPanel({ template: template({ require_geo_verification: false }) });
    expect(container.innerHTML).toBe("");
  });

  it("renders a single panel, not one per row", () => {
    renderPanel({
      rows: [
        row({ record_id: "r1", school_id: "s1" }),
        row({ record_id: "r2", school_id: "s1" }),
        row({ record_id: "r3", school_id: "s1" }),
      ],
    });
    expect(screen.getAllByRole("region", { name: /school visit verification/i })).toHaveLength(1);
  });

  it("says one photo covers every row for that school", () => {
    renderPanel({ rows: [row({ record_id: "r1" }), row({ record_id: "r2" })] });
    expect(screen.getByText(/covers all .* for this school/i)).toBeTruthy();
  });
});

describe("SchoolGeoPanel — single school", () => {
  it("offers the upload controls directly when only one school is visible", () => {
    renderPanel();
    expect(screen.getByLabelText(/take visit photo/i)).toBeTruthy();
    expect(screen.getByLabelText(/choose an existing photo/i)).toBeTruthy();
    expect(screen.queryByText(/choose a school/i)).toBeNull();
  });

  it("never requests browser location permission", () => {
    // The whole point of the EXIF flow: no geolocation prompt, no live capture button.
    const spy = vi.fn();
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: { getCurrentPosition: spy },
    });
    renderPanel();
    expect(screen.queryByRole("button", { name: /capture location/i })).toBeNull();
    expect(spy).not.toHaveBeenCalled();
  });

  it("hands the camera button to the NATIVE camera app", () => {
    // capture="environment" launches the phone's own camera, which writes GPS EXIF.
    // A getUserMedia/canvas capture inside the browser would produce a JPEG with no
    // EXIF at all, so it could never satisfy this check.
    renderPanel();
    const camera = screen.getByLabelText(/take visit photo/i) as HTMLInputElement;
    expect(camera.getAttribute("capture")).toBe("environment");
    expect(camera.accept).toMatch(/image/);
  });

  it("keeps a separate library picker with no capture attribute", () => {
    // Uploading a photo taken earlier is explicitly supported, so this input must
    // NOT force the camera.
    renderPanel();
    const library = screen.getByLabelText(/choose an existing photo/i) as HTMLInputElement;
    expect(library.hasAttribute("capture")).toBe(false);
    expect(library.accept).toMatch(/image/);
  });

  it("sends the raw file from the camera input too", async () => {
    renderPanel();
    const camera = screen.getByLabelText(/take visit photo/i) as HTMLInputElement;
    const file = new File([new Uint8Array([0xff, 0xd8, 0xff])], "IMG_9001.JPG", { type: "image/jpeg" });
    fireEvent.change(camera, { target: { files: [file] } });
    await waitFor(() => expect(uploadMutate).toHaveBeenCalledWith({ schoolId: "s1", file }));
  });

  it("sends the original file untouched", async () => {
    renderPanel();
    const input = screen.getByLabelText(/choose an existing photo/i) as HTMLInputElement;
    const file = new File([new Uint8Array([0xff, 0xd8, 0xff])], "IMG_1234.HEIC", { type: "image/heic" });
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => expect(uploadMutate).toHaveBeenCalledTimes(1));
    expect(uploadMutate).toHaveBeenCalledWith({ schoolId: "s1", file });
  });
});

describe("SchoolGeoPanel — result states", () => {
  it("shows a verified visit with distance and capture time, but no raw coordinates", () => {
    geoResult.data = [verification()];
    renderPanel();
    expect(screen.getByText(/verified/i)).toBeTruthy();
    expect(screen.getByText(/34\s*m/i)).toBeTruthy();
    // Coordinates are sensitive and must not be printed into the shared panel.
    expect(document.body.textContent).not.toMatch(/11\.01|76\.95/);
  });

  it("shows an out-of-range result as blocking", () => {
    geoResult.data = [verification({ status: "outside_radius", accepted: false, distance_m: 1420 })];
    renderPanel();
    expect(screen.getByText(/outside/i)).toBeTruthy();
    expect(screen.getByText(/1\.4\s*km|1420\s*m/i)).toBeTruthy();
  });

  it("shows an overridden result as accepted, with the reason", () => {
    geoResult.data = [verification({
      status: "outside_radius", accepted: true,
      override_by: "u9", override_at: "2026-08-24T10:00:00.000Z",
      override_reason: "Gate locked; met staff outside.",
    })];
    renderPanel();
    // Both the status badge and the reason line mention "overridden".
    expect(screen.getByText(/^overridden$/i)).toBeTruthy();
    expect(screen.getByText(/gate locked/i)).toBeTruthy();
  });

  it("reports a school with no coordinates as a setup problem, not a failed capture", async () => {
    uploadMutate.mockRejectedValue(
      Object.assign(new Error("This school has no location set yet."), { reason: "school_not_configured" }),
    );
    renderPanel();
    fireEvent.change(screen.getByLabelText(/choose an existing photo/i) as HTMLInputElement, {
      target: { files: [new File(["x"], "a.jpg", { type: "image/jpeg" })] },
    });
    expect(await screen.findByText(/no location set/i)).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/take another photo/i);
  });

  it("explains a photo with no GPS metadata", async () => {
    uploadMutate.mockRejectedValue(
      Object.assign(new Error("That photo has no location information."), { reason: "no_gps" }),
    );
    renderPanel();
    fireEvent.change(screen.getByLabelText(/choose an existing photo/i) as HTMLInputElement, {
      target: { files: [new File(["x"], "a.jpg", { type: "image/jpeg" })] },
    });
    expect(await screen.findByText(/no location information/i)).toBeTruthy();
  });

  it("explains a photo taken outside the task period", async () => {
    uploadMutate.mockRejectedValue(
      Object.assign(new Error("That photo was not taken during this task's period."), { reason: "outside_period" }),
    );
    renderPanel();
    fireEvent.change(screen.getByLabelText(/choose an existing photo/i) as HTMLInputElement, {
      target: { files: [new File(["x"], "a.jpg", { type: "image/jpeg" })] },
    });
    expect(await screen.findByText(/not taken during/i)).toBeTruthy();
  });

  it("shows a processing state while the upload is in flight", () => {
    uploadPending = true;
    renderPanel();
    expect(screen.getByText(/checking|processing/i)).toBeTruthy();
  });

  it("describes the evidence as photo metadata, not proof of presence", () => {
    geoResult.data = [verification()];
    renderPanel();
    expect(document.body.textContent).not.toMatch(/tamper-proof|proof of presence/i);
  });
});

describe("SchoolGeoPanel — multiple schools", () => {
  const multiRows = [
    row({ record_id: "r1", school_id: "s1", school_name: "Govt HSS Coimbatore" }),
    row({ record_id: "r2", school_id: "s2", school_name: "Govt HSS Annexe" }),
  ];

  it("lists every visible school with its own state", () => {
    geoResult.data = [verification({ school_id: "s1" })];
    renderPanel({ rows: multiRows });
    expect(screen.getByText("Govt HSS Coimbatore")).toBeTruthy();
    expect(screen.getByText("Govt HSS Annexe")).toBeTruthy();
    expect(screen.getAllByText(/not uploaded/i).length).toBeGreaterThan(0);
  });

  it("asks the fellow to choose a school before uploading", () => {
    renderPanel({ rows: multiRows });
    expect(screen.getByText(/choose a school/i)).toBeTruthy();
    expect(screen.queryByLabelText(/choose an existing photo/i)).toBeNull();
  });

  it("uploads against the school chosen in the shared filter", async () => {
    renderPanel({ rows: multiRows, schoolFilter: "Govt HSS Annexe" });
    const input = screen.getByLabelText(/choose an existing photo/i) as HTMLInputElement;
    const file = new File(["x"], "a.jpg", { type: "image/jpeg" });
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => expect(uploadMutate).toHaveBeenCalledWith({ schoolId: "s2", file }));
  });

  it("selects a school through the shared grid filter, not a private one", () => {
    const onChange = vi.fn();
    renderPanel({ rows: multiRows, onSchoolFilterChange: onChange });
    fireEvent.click(screen.getByRole("button", { name: /Govt HSS Annexe/i }));
    expect(onChange).toHaveBeenCalledWith("Govt HSS Annexe");
  });
});

describe("SchoolGeoPanel — manager view", () => {
  it("is read-only and offers no upload control", () => {
    geoResult.data = [verification()];
    renderPanel({ canFill: false, readOnly: true });
    expect(screen.queryByLabelText(/choose an existing photo/i)).toBeNull();
  });

  it("offers an override form for an out-of-range result", () => {
    geoResult.data = [verification({ status: "outside_radius", accepted: false })];
    renderPanel({ canFill: false, readOnly: true, canOverride: true });
    fireEvent.click(screen.getByRole("button", { name: /override/i }));
    expect(screen.getByLabelText(/reason/i)).toBeTruthy();
  });

  it("refuses to submit an override with an empty reason", () => {
    geoResult.data = [verification({ status: "outside_radius", accepted: false })];
    renderPanel({ canFill: false, readOnly: true, canOverride: true });
    fireEvent.click(screen.getByRole("button", { name: /override/i }));
    const form = screen.getByRole("form", { name: /override/i });
    fireEvent.click(within(form).getByRole("button", { name: /confirm|save|submit/i }));
    expect(overrideMutate).not.toHaveBeenCalled();
  });

  it("submits an override with a reason", async () => {
    geoResult.data = [verification({ status: "outside_radius", accepted: false })];
    renderPanel({ canFill: false, readOnly: true, canOverride: true });
    fireEvent.click(screen.getByRole("button", { name: /override/i }));
    fireEvent.change(screen.getByLabelText(/reason/i), { target: { value: "Confirmed by phone." } });
    const form = screen.getByRole("form", { name: /override/i });
    fireEvent.click(within(form).getByRole("button", { name: /confirm|save|submit/i }));
    await waitFor(() =>
      expect(overrideMutate).toHaveBeenCalledWith({ verificationId: "v1", reason: "Confirmed by phone." }),
    );
  });

  it("offers no override for a verification that already passed", () => {
    geoResult.data = [verification()];
    renderPanel({ canFill: false, readOnly: true, canOverride: true });
    expect(screen.queryByRole("button", { name: /override/i })).toBeNull();
  });
});
