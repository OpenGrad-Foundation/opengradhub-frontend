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

import {
  GeoStatusChip,
  GeoVerificationModal,
} from "@/app/dashboard/tracker/_components/geo-verification-modal";

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
    doer_id: "me", doer_name: "Me", can_fill_self: true, can_fill_override: false,
    can_evidence: true, can_blocker: true, fill_reason: null,
    lifecycle: "not_started", ...over,
  }) as TrackerGridRow;

const verification = (over: Partial<TrackerGeoVerification> = {}): TrackerGeoVerification => ({
  id: "v1", school_id: "s1", doer_id: "me", status: "verified", accepted: true,
  distance_m: 34.2, radius_m: 200, accuracy_m: null,
  exif_captured_at: "2026-08-24T04:15:00.000Z",
  uploaded_at: "2026-08-24T09:00:00.000Z",
  preview_url: "https://signed.test/preview.jpg",
  override_by: null, override_at: null, override_reason: null,
  ...over,
});

const onClose = vi.fn();

function renderModal(props: Partial<React.ComponentProps<typeof GeoVerificationModal>> = {}) {
  return render(
    <GeoVerificationModal
      template={template()}
      rows={[row()]}
      canFill
      onClose={onClose}
      {...props}
    />,
  );
}

function renderChip(props: Partial<React.ComponentProps<typeof GeoStatusChip>> = {}) {
  return render(
    <GeoStatusChip template={template()} rows={[row()]} onOpen={() => {}} {...props} />,
  );
}

beforeEach(() => {
  geoResult = { data: [], isLoading: false };
  uploadMutate.mockReset();
  uploadMutate.mockResolvedValue(verification());
  overrideMutate.mockReset();
  onClose.mockReset();
  uploadPending = false;
});

describe("GeoStatusChip", () => {
  it("renders nothing when the task does not require verification", () => {
    const { container } = renderChip({ template: template({ require_geo_verification: false }) });
    expect(container.innerHTML).toBe("");
  });

  it("summarises how many schools are verified", () => {
    geoResult.data = [verification({ school_id: "s1" })];
    renderChip({
      rows: [
        row({ record_id: "r1", school_id: "s1", school_name: "Govt HSS Coimbatore" }),
        row({ record_id: "r2", school_id: "s2", school_name: "Govt HSS Annexe" }),
      ],
    });
    expect(screen.getByRole("button", { name: /visit verification/i }).textContent)
      .toMatch(/1\s*\/\s*2/);
  });

  it("counts each school once even when it has many rows", () => {
    geoResult.data = [];
    renderChip({
      rows: [
        row({ record_id: "r1", school_id: "s1" }),
        row({ record_id: "r2", school_id: "s1" }),
        row({ record_id: "r3", school_id: "s1" }),
      ],
    });
    expect(screen.getByRole("button", { name: /visit verification/i }).textContent)
      .toMatch(/0\s*\/\s*1/);
  });

  it("opens the modal when clicked", () => {
    const onOpen = vi.fn();
    renderChip({ onOpen });
    fireEvent.click(screen.getByRole("button", { name: /visit verification/i }));
    expect(onOpen).toHaveBeenCalled();
  });
});

describe("GeoVerificationModal — shell", () => {
  it("renders one centred dialog, not one panel per row", () => {
    renderModal({
      rows: [
        row({ record_id: "r1", school_id: "s1" }),
        row({ record_id: "r2", school_id: "s1" }),
        row({ record_id: "r3", school_id: "s1" }),
      ],
    });
    expect(screen.getAllByRole("dialog", { name: /school visit verification/i })).toHaveLength(1);
  });

  it("says one photo covers every row for that school", () => {
    renderModal({ rows: [row({ record_id: "r1" }), row({ record_id: "r2" })] });
    expect(screen.getByText(/covers all .* for this school/i)).toBeTruthy();
  });

  it("closes on the close button", () => {
    renderModal();
    fireEvent.click(screen.getByRole("button", { name: /close verification/i }));
    expect(onClose).toHaveBeenCalled();
  });

  it("closes on Escape", () => {
    renderModal();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });

  it("explains why the row is blocked when opened by the gate", () => {
    renderModal({ initialSchoolId: "s1", blocking: true });
    expect(screen.getByText(/before you can mark/i)).toBeTruthy();
  });
});

describe("GeoVerificationModal — single school", () => {
  it("offers the upload controls for the school", () => {
    renderModal();
    expect(screen.getByLabelText(/take visit photo/i)).toBeTruthy();
    expect(screen.getByLabelText(/choose an existing photo/i)).toBeTruthy();
  });

  it("never requests browser location permission", () => {
    // The whole point of the EXIF flow: no geolocation prompt, no live capture button.
    const spy = vi.fn();
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: { getCurrentPosition: spy },
    });
    renderModal();
    expect(screen.queryByRole("button", { name: /capture location/i })).toBeNull();
    expect(spy).not.toHaveBeenCalled();
  });

  it("hands the camera button to the NATIVE camera app", () => {
    // capture="environment" launches the phone's own camera, which writes GPS EXIF.
    // A getUserMedia/canvas capture inside the browser would produce a JPEG with no
    // EXIF at all, so it could never satisfy this check.
    renderModal();
    const camera = screen.getByLabelText(/take visit photo/i) as HTMLInputElement;
    expect(camera.getAttribute("capture")).toBe("environment");
    expect(camera.accept).toMatch(/image/);
  });

  it("keeps a separate library picker with no capture attribute", () => {
    // Uploading a photo taken earlier is explicitly supported, so this input must
    // NOT force the camera.
    renderModal();
    const library = screen.getByLabelText(/choose an existing photo/i) as HTMLInputElement;
    expect(library.hasAttribute("capture")).toBe(false);
    expect(library.accept).toMatch(/image/);
  });

  it("sends the raw file from the camera input too", async () => {
    renderModal();
    const camera = screen.getByLabelText(/take visit photo/i) as HTMLInputElement;
    const file = new File([new Uint8Array([0xff, 0xd8, 0xff])], "IMG_9001.JPG", { type: "image/jpeg" });
    fireEvent.change(camera, { target: { files: [file] } });
    await waitFor(() => expect(uploadMutate).toHaveBeenCalledWith({ schoolId: "s1", file }));
  });

  it("sends the original file untouched", async () => {
    renderModal();
    const input = screen.getByLabelText(/choose an existing photo/i) as HTMLInputElement;
    const file = new File([new Uint8Array([0xff, 0xd8, 0xff])], "IMG_1234.HEIC", { type: "image/heic" });
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => expect(uploadMutate).toHaveBeenCalledTimes(1));
    expect(uploadMutate).toHaveBeenCalledWith({ schoolId: "s1", file });
  });

  it("offers a retake once a photo is on file", () => {
    geoResult.data = [verification()];
    renderModal();
    expect(screen.getByText(/retake|replace/i)).toBeTruthy();
  });
});

describe("GeoVerificationModal — past the due date", () => {
  // A photo can only help a row that is still completable. Once every row for the school
  // is overdue, only a manager's extension reopens it, so the upload is withdrawn rather
  // than left there to produce evidence nobody can use.
  it("withdraws the upload when every row for the school is overdue", () => {
    renderModal({ rows: [row({ lifecycle: "overdue" })] });
    expect(screen.queryByLabelText(/choose an existing photo/i)).toBeNull();
    expect(screen.queryByLabelText(/take visit photo/i)).toBeNull();
  });

  it("says an extension is what reopens it", () => {
    renderModal({ rows: [row({ lifecycle: "overdue" })] });
    expect(screen.getByText(/extension/i)).toBeTruthy();
  });

  it("still shows the verification that was already accepted", () => {
    geoResult.data = [verification()];
    renderModal({ rows: [row({ lifecycle: "overdue" })] });
    expect(screen.getByText(/verified/i)).toBeTruthy();
    expect(screen.getByText(/34\s*m/i)).toBeTruthy();
  });

  it("keeps the upload while any row for that school is still open", () => {
    renderModal({
      rows: [
        row({ record_id: "r1", lifecycle: "overdue" }),
        row({ record_id: "r2", lifecycle: "not_started" }),
      ],
    });
    expect(screen.getByLabelText(/choose an existing photo/i)).toBeTruthy();
  });

  it("withdraws it only for the school that is out of time", () => {
    renderModal({
      rows: [
        row({ record_id: "r1", school_id: "s1", school_name: "Govt HSS Coimbatore", lifecycle: "overdue" }),
        row({ record_id: "r2", school_id: "s2", school_name: "Govt HSS Annexe" }),
      ],
    });
    expect(screen.getAllByLabelText(/choose an existing photo/i)).toHaveLength(1);
    expect(screen.getByLabelText(/choose an existing photo for Govt HSS Annexe/i)).toBeTruthy();
  });

  it("does not withdraw it for a school whose rows are simply done", () => {
    // Done is not out of time: a fellow may still replace the photo behind it.
    geoResult.data = [verification()];
    renderModal({ rows: [row({ lifecycle: "done", status: "done" })] });
    expect(screen.getByLabelText(/choose an existing photo/i)).toBeTruthy();
  });
});

describe("GeoVerificationModal — result states", () => {
  it("shows a verified visit with distance and capture time, but no raw coordinates", () => {
    geoResult.data = [verification()];
    renderModal();
    expect(screen.getByText(/verified/i)).toBeTruthy();
    expect(screen.getByText(/34\s*m/i)).toBeTruthy();
    // Coordinates are sensitive and must not be printed into the shared panel.
    expect(document.body.textContent).not.toMatch(/11\.01|76\.95/);
  });

  it("shows an out-of-range result as blocking", () => {
    geoResult.data = [verification({ status: "outside_radius", accepted: false, distance_m: 1420 })];
    renderModal();
    expect(screen.getByText(/outside/i)).toBeTruthy();
    expect(screen.getByText(/1\.4\s*km|1420\s*m/i)).toBeTruthy();
  });

  it("shows an overridden result as accepted, with the reason", () => {
    geoResult.data = [verification({
      status: "outside_radius", accepted: true,
      override_by: "u9", override_at: "2026-08-24T10:00:00.000Z",
      override_reason: "Gate locked; met staff outside.",
    })];
    renderModal();
    // Both the status badge and the reason line mention "overridden".
    expect(screen.getByText(/^overridden$/i)).toBeTruthy();
    expect(screen.getByText(/gate locked/i)).toBeTruthy();
  });

  it("reports a school with no coordinates as a setup problem, not a failed capture", async () => {
    uploadMutate.mockRejectedValue(
      Object.assign(new Error("This school has no location set yet."), { reason: "school_not_configured" }),
    );
    renderModal();
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
    renderModal();
    fireEvent.change(screen.getByLabelText(/choose an existing photo/i) as HTMLInputElement, {
      target: { files: [new File(["x"], "a.jpg", { type: "image/jpeg" })] },
    });
    expect(await screen.findByText(/no location information/i)).toBeTruthy();
  });

  it("explains a photo taken outside the task period", async () => {
    uploadMutate.mockRejectedValue(
      Object.assign(new Error("That photo was not taken during this task's period."), { reason: "outside_period" }),
    );
    renderModal();
    fireEvent.change(screen.getByLabelText(/choose an existing photo/i) as HTMLInputElement, {
      target: { files: [new File(["x"], "a.jpg", { type: "image/jpeg" })] },
    });
    expect(await screen.findByText(/not taken during/i)).toBeTruthy();
  });

  it("shows a processing state while the upload is in flight", () => {
    uploadPending = true;
    renderModal();
    expect(screen.getByText(/checking|processing/i)).toBeTruthy();
  });

  it("describes the evidence as photo metadata, not proof of presence", () => {
    geoResult.data = [verification()];
    renderModal();
    expect(document.body.textContent).not.toMatch(/tamper-proof|proof of presence/i);
  });
});

describe("GeoVerificationModal — closing after an upload", () => {
  it("closes itself once the gate's own school is verified", async () => {
    renderModal({ initialSchoolId: "s1", blocking: true });
    fireEvent.change(screen.getByLabelText(/choose an existing photo/i) as HTMLInputElement, {
      target: { files: [new File(["x"], "a.jpg", { type: "image/jpeg" })] },
    });
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it("stays open on an out-of-range result so the fellow sees why", async () => {
    uploadMutate.mockResolvedValue(
      verification({ status: "outside_radius", accepted: false, distance_m: 1420 }),
    );
    renderModal({ initialSchoolId: "s1", blocking: true });
    fireEvent.change(screen.getByLabelText(/choose an existing photo/i) as HTMLInputElement, {
      target: { files: [new File(["x"], "a.jpg", { type: "image/jpeg" })] },
    });
    await waitFor(() => expect(uploadMutate).toHaveBeenCalled());
    expect(onClose).not.toHaveBeenCalled();
  });

  it("stays open when it was opened from the chip rather than a blocked row", async () => {
    renderModal();
    fireEvent.change(screen.getByLabelText(/choose an existing photo/i) as HTMLInputElement, {
      target: { files: [new File(["x"], "a.jpg", { type: "image/jpeg" })] },
    });
    await waitFor(() => expect(uploadMutate).toHaveBeenCalled());
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe("GeoVerificationModal — multiple schools", () => {
  const multiRows = [
    row({ record_id: "r1", school_id: "s1", school_name: "Govt HSS Coimbatore" }),
    row({ record_id: "r2", school_id: "s2", school_name: "Govt HSS Annexe" }),
  ];

  it("lists every visible school with its own state", () => {
    geoResult.data = [verification({ school_id: "s1" })];
    renderModal({ rows: multiRows });
    expect(screen.getByText("Govt HSS Coimbatore")).toBeTruthy();
    expect(screen.getByText("Govt HSS Annexe")).toBeTruthy();
    expect(screen.getAllByText(/not uploaded/i).length).toBeGreaterThan(0);
  });

  it("gives each school its own upload controls instead of a shared picker", () => {
    renderModal({ rows: multiRows });
    expect(screen.getAllByLabelText(/choose an existing photo/i)).toHaveLength(2);
    expect(screen.queryByText(/choose a school/i)).toBeNull();
  });

  it("uploads against the school whose control was used", async () => {
    renderModal({ rows: multiRows });
    const input = screen.getByLabelText(/choose an existing photo for Govt HSS Annexe/i) as HTMLInputElement;
    const file = new File(["x"], "a.jpg", { type: "image/jpeg" });
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => expect(uploadMutate).toHaveBeenCalledWith({ schoolId: "s2", file }));
  });

  it("puts the school that blocked the row first", () => {
    renderModal({ rows: multiRows, initialSchoolId: "s2", blocking: true });
    const names = screen.getAllByRole("group").map((g) => g.getAttribute("aria-label"));
    expect(names[0]).toMatch(/Govt HSS Annexe/i);
  });

  it("reports an upload failure against the school it was for", async () => {
    uploadMutate.mockRejectedValue(
      Object.assign(new Error("That photo has no location information."), { reason: "no_gps" }),
    );
    renderModal({ rows: multiRows });
    fireEvent.change(
      screen.getByLabelText(/choose an existing photo for Govt HSS Annexe/i) as HTMLInputElement,
      { target: { files: [new File(["x"], "a.jpg", { type: "image/jpeg" })] } },
    );
    const card = await screen.findByRole("group", { name: /Govt HSS Annexe/i });
    expect(within(card).getByText(/no location information/i)).toBeTruthy();
    const other = screen.getByRole("group", { name: /Govt HSS Coimbatore/i });
    expect(within(other).queryByText(/no location information/i)).toBeNull();
  });
});

describe("GeoVerificationModal — manager view", () => {
  it("is read-only and offers no upload control", () => {
    geoResult.data = [verification()];
    renderModal({ canFill: false, readOnly: true });
    expect(screen.queryByLabelText(/choose an existing photo/i)).toBeNull();
  });

  it("offers an override form for an out-of-range result", () => {
    geoResult.data = [verification({ status: "outside_radius", accepted: false })];
    renderModal({ canFill: false, readOnly: true, canOverride: true });
    fireEvent.click(screen.getByRole("button", { name: /override/i }));
    expect(screen.getByLabelText(/reason/i)).toBeTruthy();
  });

  it("refuses to submit an override with an empty reason", () => {
    geoResult.data = [verification({ status: "outside_radius", accepted: false })];
    renderModal({ canFill: false, readOnly: true, canOverride: true });
    fireEvent.click(screen.getByRole("button", { name: /override/i }));
    const form = screen.getByRole("form", { name: /override/i });
    fireEvent.click(within(form).getByRole("button", { name: /confirm|save|submit/i }));
    expect(overrideMutate).not.toHaveBeenCalled();
  });

  it("submits an override with a reason", async () => {
    geoResult.data = [verification({ status: "outside_radius", accepted: false })];
    renderModal({ canFill: false, readOnly: true, canOverride: true });
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
    renderModal({ canFill: false, readOnly: true, canOverride: true });
    expect(screen.queryByRole("button", { name: /override/i })).toBeNull();
  });
});
