import type { AppRole } from "@/lib/auth";

export type NavItem = {
  href: string;
  label: string;
  short: string;
  roles: AppRole[];
};

export const NAV_ITEMS: NavItem[] = [
  {
    href: "/dashboard",
    label: "Dashboard",
    short: "DB",
    roles: ["admin", "supervisor", "accountant", "teacher", "clerk", "staff", "student", "parent"],
  },
  {
    href: "/admissions",
    label: "Admissions",
    short: "AD",
    roles: ["admin", "supervisor", "clerk"],
  },
  {
    href: "/bulk-onboarding",
    label: "Bulk Onboarding",
    short: "BO",
    roles: ["admin", "supervisor", "clerk"],
  },
  {
    href: "/students",
    label: "Students",
    short: "ST",
    roles: ["admin", "supervisor", "teacher", "clerk"],
  },
  {
    href: "/staff",
    label: "Staff",
    short: "SF",
    roles: ["admin", "supervisor", "clerk"],
  },
  {
    href: "/staff/contracts",
    label: "Staff Appointments",
    short: "HR",
    roles: ["admin", "supervisor", "clerk"],
  },
  {
    href: "/classes",
    label: "Classes & Sections",
    short: "CL",
    roles: ["admin", "supervisor", "teacher", "clerk"],
  },
  {
    href: "/subjects",
    label: "Subjects",
    short: "SU",
    roles: ["admin", "supervisor", "teacher"],
  },
  {
    href: "/teacher-assignments",
    label: "Teacher Assignments",
    short: "TA",
    roles: ["admin", "supervisor", "teacher"],
  },
  {
    href: "/account",
    label: "My Account",
    short: "AC",
    roles: ["admin", "supervisor", "accountant", "teacher", "clerk", "staff", "student", "parent"],
  },
];

export function navigationForRole(role: AppRole) {
  return NAV_ITEMS.filter((item) => item.roles.includes(role));
}
