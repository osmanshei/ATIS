"use client";

import { useActionState } from "react";
import {
  createSingleStaffAction,
  initialSingleStaffState,
} from "@/app/(protected)/staff/onboarding/actions";

export function StaffSingleOnboarding() {
  const [state, action, pending] = useActionState(
    createSingleStaffAction,
    initialSingleStaffState,
  );

  return (
    <>
      <form className="form-card" action={action}>
        <h2 className="section-title">Staff details</h2>
        <p className="muted">
          Full name, phone number and email are required. ATIS generates the employee
          code, username and temporary password when needed.
        </p>

        <div className="form-grid">
          <div className="field">
            <label>Full name *</label>
            <input name="full_name" required />
          </div>
          <div className="field">
            <label>Phone number *</label>
            <input name="mobile" required />
          </div>
          <div className="field">
            <label>Email *</label>
            <input name="email" type="email" required />
          </div>
          <div className="field">
            <label>Employee code</label>
            <input name="employee_code" placeholder="Leave blank for ATIS to generate" />
          </div>
          <div className="field">
            <label>System role</label>
            <select name="role" defaultValue="teacher">
              <option value="teacher">Teacher</option>
              <option value="supervisor">Supervisor</option>
              <option value="accountant">Accountant</option>
              <option value="clerk">Clerk / Secretary</option>
              <option value="staff">Other Staff</option>
            </select>
          </div>
          <div className="field">
            <label>Position / Job title</label>
            <input
              name="position_title"
              placeholder="Teacher, Cleaner, Cook, Caretaker, Security Guard..."
            />
          </div>
          <div className="field">
            <label>Specialization / Duty</label>
            <input name="specialization_duty" />
          </div>
          <div className="field">
            <label>Gender</label>
            <select name="gender">
              <option value="">Not set</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
          </div>
          <div className="field">
            <label>Date of birth</label>
            <input name="date_of_birth" type="date" />
          </div>
          <div className="field">
            <label>Date of employment</label>
            <input name="joining_date" type="date" />
          </div>
          <div className="field">
            <label>Qualification</label>
            <input name="qualification" />
          </div>
          <div className="field">
            <label>Address</label>
            <input name="address" />
          </div>
          <div className="field">
            <label>Staff picture</label>
            <input
              name="photo"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              capture="user"
            />
            <small className="muted">Take or upload a portrait. JPG, PNG or WebP, maximum 5 MB.</small>
          </div>
          <div className="field">
            <label>Emergency contact name</label>
            <input name="emergency_contact_name" />
          </div>
          <div className="field">
            <label>Emergency contact phone</label>
            <input name="emergency_contact_phone" />
          </div>
        </div>

        <button className="button" type="submit" disabled={pending}>
          {pending ? "Creating staff account..." : "Add Staff & Create Login"}
        </button>
      </form>

      {state.message ? (
        <div className={state.ok ? "notice success" : "notice error"}>{state.message}</div>
      ) : null}

      {state.ok && state.username && state.temporaryPassword ? (
        <section className="card credential-card">
          <div className="eyebrow">New login details</div>
          <h2 className="section-title">{state.fullName}</h2>
          <div className="credential-grid">
            <div><span>Employee Code</span><strong>{state.employeeCode}</strong></div>
            <div><span>Username</span><strong>{state.username}</strong></div>
            <div><span>Temporary Password</span><strong>{state.temporaryPassword}</strong></div>
            <div>
              <span>Delivery</span>
              <strong>
                SMS: {state.smsSent ? "Sent" : "Not sent"} · Email: {state.emailSent ? "Sent" : "Not sent"}
              </strong>
            </div>
          </div>
          <p className="muted">
            Save or give these credentials to the staff member now. The temporary password
            is not stored in readable form.
          </p>
        </section>
      ) : null}
    </>
  );
}
