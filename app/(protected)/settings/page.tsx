import Image from "next/image";
import { requireProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  saveAcademicCalendarAction,
  saveSchoolMessagingAction,
  saveSchoolProfileAction,
} from "./actions";

export default async function SchoolSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { supabase, profile } = await requireProfile(["admin"]);
  const params = await searchParams;
  const admin = createAdminClient();

  const [
    { data: school },
    { data: years },
    { data: terms },
    { data: messagingSettings },
  ] = await Promise.all([
    supabase.from("schools").select("*").eq("id", profile.school_id).single(),
    supabase.from("academic_years").select("id,name,starts_on,ends_on,is_current").eq("school_id", profile.school_id).order("starts_on", { ascending: false }),
    supabase.from("terms").select("id,name,academic_year_id,starts_on,ends_on,is_current").eq("school_id", profile.school_id).order("starts_on"),
    admin.from("school_settings").select("setting_key,setting_value,is_secret").eq("school_id", profile.school_id).in("setting_key", ["SMS_SENDER_ID", "SMS_API_KEY"]),
  ]);

  const currentYear = (years || []).find((item: any) => item.is_current);
  const currentTerm = (terms || []).find((item: any) => item.is_current);
  const senderId = (messagingSettings || []).find((item: any) => item.setting_key === "SMS_SENDER_ID")?.setting_value || "";
  const hasSmsKey = Boolean((messagingSettings || []).find((item: any) => item.setting_key === "SMS_API_KEY")?.setting_value);
  const selectedYearId = currentYear?.id || "";
  const selectedTermId = currentTerm?.id || "";

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Administration</div>
          <h1>School Settings</h1>
          <p>Manage the school's identity, academic calendar and messaging configuration.</p>
        </div>
      </div>

      {params.ok ? <div className="notice success">{params.ok}</div> : null}
      {params.error ? <div className="notice error">{params.error}</div> : null}

      <section className="panel-section">
        <div className="section-heading">
          <div><div className="eyebrow">School identity</div><h2>School profile</h2><p className="muted">These details identify ATIS across school records and printed documents.</p></div>
        </div>
        <form className="card settings-form" action={saveSchoolProfileAction}>
          <div className="settings-logo-preview">
            <Image src={school?.logo_url || "/atis-logo.svg"} alt="School logo preview" width={76} height={76} unoptimized />
            <div><strong>School logo</strong><p className="muted">Paste the public image URL below. Leave the field blank to use the built-in ATIS logo.</p></div>
          </div>
          <div className="grid-2">
            <div className="field"><label>Official school name</label><input name="name" defaultValue={school?.name || ""} required /></div>
            <div className="field"><label>Short name</label><input name="short_name" defaultValue={school?.short_name || "ATIS"} /></div>
            <div className="field"><label>Phone number(s)</label><input name="phone" defaultValue={school?.phone || ""} /></div>
            <div className="field"><label>Email address</label><input name="email" type="email" defaultValue={school?.email || ""} /></div>
            <div className="field"><label>Address</label><input name="address" defaultValue={school?.address || ""} /></div>
            <div className="field"><label>City / town</label><input name="city" defaultValue={school?.city || "Bimbilla"} /></div>
            <div className="field"><label>Region</label><input name="region" defaultValue={school?.region || "Northern Region"} /></div>
            <div className="field"><label>Country</label><input name="country" defaultValue={school?.country || "Ghana"} /></div>
            <div className="field"><label>Website</label><input name="website" type="url" defaultValue={school?.website || ""} placeholder="https://" /></div>
            <div className="field"><label>Logo image URL</label><input name="logo_url" type="url" defaultValue={school?.logo_url || ""} placeholder="https://..." /></div>
            <div className="field"><label>Time zone</label><input name="timezone" defaultValue={school?.timezone || "Africa/Accra"} required /></div>
            <div className="field"><label>Currency code</label><input name="currency_code" defaultValue={school?.currency_code || "GHS"} maxLength={3} required /></div>
          </div>
          <button className="button" type="submit">Save School Profile</button>
        </form>
      </section>

      <section className="panel-section">
        <div className="section-heading">
          <div><div className="eyebrow">Academic calendar</div><h2>Current academic year & term</h2><p className="muted">Changing these selections updates the current year and term used by the school modules.</p></div>
        </div>
        <form className="card settings-form" action={saveAcademicCalendarAction}>
          <div className="grid-2">
            <div className="field">
              <label>Academic year</label>
              <select name="academic_year_id" defaultValue={selectedYearId} required>
                <option value="" disabled>Select academic year</option>
                {(years || []).map((year: any) => <option key={year.id} value={year.id}>{year.name} {year.is_current ? "· Current" : ""}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Current term</label>
              <select name="term_id" defaultValue={selectedTermId} required>
                <option value="" disabled>Select term</option>
                {(terms || []).map((term: any) => {
                  const year = (years || []).find((item: any) => item.id === term.academic_year_id);
                  return <option key={term.id} value={term.id}>{term.name} · {year?.name || "Academic year"}</option>;
                })}
              </select>
            </div>
          </div>
          <button className="button" type="submit">Update Current Academic Period</button>
        </form>
      </section>

      <section className="panel-section">
        <div className="section-heading">
          <div><div className="eyebrow">Communications</div><h2>SMS integration</h2><p className="muted">Store the provider credentials ATIS will use when SMS notifications are enabled.</p></div>
        </div>
        <form className="card settings-form" action={saveSchoolMessagingAction}>
          <div className="grid-2">
            <div className="field"><label>SMS Sender ID</label><input name="sms_sender_id" defaultValue={senderId} placeholder="e.g. ATIS SCHOOL" /></div>
            <div className="field">
              <label>SMS API key</label>
              <input name="sms_api_key" type="password" autoComplete="new-password" placeholder={hasSmsKey ? "Saved — leave blank to keep current key" : "Enter provider API key"} />
              <small className="muted">{hasSmsKey ? "An API key is already saved. It is hidden for security." : "No API key has been saved yet."}</small>
            </div>
          </div>
          <button className="button" type="submit">Save Messaging Settings</button>
        </form>
      </section>
    </>
  );
}
