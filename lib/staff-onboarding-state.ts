export type StaffCredentialRow = {
  fullName: string;
  employeeCode: string;
  role: string;
  position: string;
  email: string;
  phone: string;
  username: string;
  temporaryPassword: string;
  smsSent: boolean;
  emailSent: boolean;
};

export type StaffBulkState = {
  ok: boolean;
  message: string;
  imported: number;
  skipped: number;
  invalid: number;
  credentials: StaffCredentialRow[];
};

export const initialStaffBulkState: StaffBulkState = {
  ok: false,
  message: "",
  imported: 0,
  skipped: 0,
  invalid: 0,
  credentials: [],
};

export type SingleStaffState = {
  ok: boolean;
  message: string;
  staffId?: string;
  fullName?: string;
  employeeCode?: string;
  username?: string;
  temporaryPassword?: string;
  smsSent?: boolean;
  emailSent?: boolean;
};

export const initialSingleStaffState: SingleStaffState = {
  ok: false,
  message: "",
};
