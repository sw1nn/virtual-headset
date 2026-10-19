import { describe, it, expect, beforeEach } from "vitest";
import { pickAdapter, ADAPTERS } from "../src/adapters";

describe("pickAdapter", () => {
  it("selects the zoom adapter for *.zoom.us", () => {
    expect(pickAdapter("app.zoom.us")).toBe(ADAPTERS.zoom);
    expect(pickAdapter("us02web.zoom.us")).toBe(ADAPTERS.zoom);
  });

  it("selects the meet adapter for meet.google.com", () => {
    expect(pickAdapter("meet.google.com")).toBe(ADAPTERS.meet);
  });

  it("selects the teams adapter for Teams hosts and subdomains", () => {
    expect(pickAdapter("teams.microsoft.com")).toBe(ADAPTERS.teams);
    expect(pickAdapter("eu.teams.microsoft.com")).toBe(ADAPTERS.teams);
    expect(pickAdapter("teams.live.com")).toBe(ADAPTERS.teams);
    expect(pickAdapter("teams.cloud.microsoft")).toBe(ADAPTERS.teams);
    expect(pickAdapter("teams.microsoft.us")).toBe(ADAPTERS.teams);
    expect(pickAdapter("teams.microsoft.com.mcas.ms")).toBe(ADAPTERS.teams);
    expect(pickAdapter("teams.microsoft.us.mcas-gov.us")).toBe(ADAPTERS.teams);
  });

  it("returns null for unsupported / look-alike hosts", () => {
    expect(pickAdapter("example.com")).toBeNull();
    expect(pickAdapter("zoom.us.evil.com")).toBeNull();
    expect(pickAdapter("evilzoom.us")).toBeNull();
    expect(pickAdapter("meet.google.com.evil.com")).toBeNull();
    expect(pickAdapter("teams.microsoft.com.evil.com")).toBeNull();
    expect(pickAdapter("noteams.microsoft.com")).toBeNull();
  });
});

describe("zoom adapter", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("treats an exact 'unmute' label as muted", () => {
    document.body.innerHTML = `<button aria-label="unmute">x</button>`;
    const el = ADAPTERS.zoom.find()!;
    expect(el).not.toBeNull();
    expect(ADAPTERS.zoom.isMuted(el)).toBe(true);
  });

  it("treats an exact 'mute' label as unmuted", () => {
    document.body.innerHTML = `<button aria-label="mute">x</button>`;
    const el = ADAPTERS.zoom.find()!;
    expect(ADAPTERS.zoom.isMuted(el)).toBe(false);
  });

  it("matches longer labels via the fallback scan", () => {
    document.body.innerHTML = `
      <button aria-label="leave">l</button>
      <button aria-label="unmute my microphone">m</button>`;
    const el = ADAPTERS.zoom.find()!;
    expect(el).not.toBeNull();
    expect(ADAPTERS.zoom.isMuted(el)).toBe(true);
  });

  it("find() returns null when there is no mic button", () => {
    document.body.innerHTML = `<button aria-label="leave">x</button>`;
    expect(ADAPTERS.zoom.find()).toBeNull();
  });
});

describe("meet adapter", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("reads muted from data-is-muted=true", () => {
    document.body.innerHTML = `<button data-is-muted="true" aria-label="Turn on microphone">x</button>`;
    const el = ADAPTERS.meet.find()!;
    expect(el).not.toBeNull();
    expect(ADAPTERS.meet.isMuted(el)).toBe(true);
  });

  it("reads unmuted from data-is-muted=false", () => {
    document.body.innerHTML = `<button data-is-muted="false" aria-label="Turn off microphone">x</button>`;
    const el = ADAPTERS.meet.find()!;
    expect(ADAPTERS.meet.isMuted(el)).toBe(false);
  });

  it("falls back to the aria-label when data-is-muted is absent", () => {
    document.body.innerHTML = `<button aria-label="Turn on microphone (ctrl+d)">x</button>`;
    const el = ADAPTERS.meet.find()!;
    expect(el).not.toBeNull();
    expect(ADAPTERS.meet.isMuted(el)).toBe(true);
  });
});

describe("teams adapter", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("reads muted from #microphone-button data-state=mic-off", () => {
    document.body.innerHTML = `<button id="microphone-button" data-state="mic-off">x</button>`;
    const el = ADAPTERS.teams.find()!;
    expect(el).not.toBeNull();
    expect(ADAPTERS.teams.isMuted(el)).toBe(true);
  });

  it("accepts the alternate data-state=muted spelling", () => {
    document.body.innerHTML = `<button id="microphone-button" data-state="muted">x</button>`;
    const el = ADAPTERS.teams.find()!;
    expect(ADAPTERS.teams.isMuted(el)).toBe(true);
  });

  it("reads unmuted from #microphone-button data-state=mic-on", () => {
    document.body.innerHTML = `<button id="microphone-button" data-state="mic-on">x</button>`;
    const el = ADAPTERS.teams.find()!;
    expect(el).not.toBeNull();
    expect(ADAPTERS.teams.isMuted(el)).toBe(false);
  });

  it("finds the button by data-tid when the id is absent", () => {
    document.body.innerHTML = `<button data-tid="toggle-mute" data-state="mic-off">x</button>`;
    const el = ADAPTERS.teams.find()!;
    expect(el).not.toBeNull();
    expect(ADAPTERS.teams.isMuted(el)).toBe(true);
  });

  it("falls back to aria-label when data-state is absent", () => {
    document.body.innerHTML = `<button aria-label="Unmute">x</button>`;
    const el = ADAPTERS.teams.find()!;
    expect(el).not.toBeNull();
    expect(ADAPTERS.teams.isMuted(el)).toBe(true);

    document.body.innerHTML = `<button aria-label="Mute">x</button>`;
    const unmuted = ADAPTERS.teams.find()!;
    expect(ADAPTERS.teams.isMuted(unmuted)).toBe(false);
  });

  it("find() returns null when there is no mic button", () => {
    document.body.innerHTML = `<button aria-label="Leave">x</button>`;
    expect(ADAPTERS.teams.find()).toBeNull();
  });
});
