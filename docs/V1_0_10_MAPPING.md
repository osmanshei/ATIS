# ATIS v1.0.10 → ATIS Web v0.1 core mapping

This inventory was extracted from the actual v1.0.10 `Code.gs` package and is the migration reference for the first hosted release.

## Important normalization decisions

- `Classes.TotalStrength` is **not migrated as an authoritative counter**. ATIS Web derives class strength from active student records.
- Legacy `Subjects` rows combine the subject definition and the class link. ATIS Web separates them into `subject_catalogue` and `class_subjects`.
- `Teacher_Assignments` points to `class_subjects`, preserving the teacher/class/subject relationship without repeated subject definitions.
- Non-teaching duties remain HR attributes (`position_title` / `specialization_duty`) while system permissions use the restricted `staff` role.
- Fields not promoted into v0.1 columns can be preserved in `legacy_payload` during migration so no source data is silently discarded.

## Users (26 legacy columns)

`ID`, `Username`, `FullName`, `Email`, `Password`, `Mobile`, `Role`, `Gender`, `DateOfBirth`, `Qualification`, `Specialization`, `JoiningDate`, `ProfilePhoto`, `Address`, `Status`, `LastLogin`, `IsDeleted`, `ThemeMode`, `CustomColors`, `CreatedAt`, `CreatedBy`, `UpdatedAt`, `UpdatedBy`, `EmployeeCode`, `EmergencyContactName`, `EmergencyContactPhone`

## Classes (20 legacy columns)

`ID`, `ClassName`, `Section`, `AcademicYear`, `ClassTeacherID`, `TotalStrength`, `IsDeleted`, `CreatedAt`, `UpdatedAt`, `GradeLevel`, `ClassCode`, `CurriculumStage`, `MediumOfInstruction`, `SubjectStream`, `MaxCapacity`, `RoomNumber`, `Building`, `AssistantTeacherID`, `IsActive`, `Shift`

## Subjects (17 legacy columns)

`ID`, `SubjectName`, `SubjectCode`, `ClassID`, `MaxMarks`, `IsDeleted`, `CreatedAt`, `UpdatedAt`, `PassMarks`, `SubjectType`, `TheoryMaxMarks`, `PracticalMaxMarks`, `TheoryPassMarks`, `PracticalPassMarks`, `IsActive`, `IsOptional`, `SubjectGroup`

## Teacher_Assignments (9 legacy columns)

`ID`, `TeacherID`, `ClassID`, `SubjectID`, `AcademicYear`, `IsClassTeacher`, `CreatedAt`, `UpdatedAt`, `PeriodsPerWeek`

## Students (63 legacy columns)

`ID`, `AdmissionNumber`, `FirstName`, `MiddleName`, `LastName`, `Gender`, `DateOfBirth`, `BloodGroup`, `GhanaCardNo`, `StudentMobileLegacy`, `StudentEmailLegacy`, `AddressLine`, `City`, `State`, `PinCode`, `FatherName`, `FatherOccupation`, `FatherMobile`, `MotherName`, `MotherOccupation`, `MotherMobile`, `GuardianName`, `GuardianRelation`, `GuardianMobile`, `AdmissionDate`, `ClassID`, `RollNumber`, `Category`, `NHISNo`, `PreviousSchool`, `TransportRequired`, `TransportRoute`, `MedicalNotes`, `PhotoURL`, `StudentPortalPasswordLegacy`, `Status`, `IsDeleted`, `CreatedAt`, `UpdatedAt`, `Nationality`, `SecondNationality`, `CountryOfBirth`, `PreferredName`, `PassportNumber`, `PassportExpiry`, `VisaType`, `VisaExpiry`, `MotherTongue`, `HomeLanguage`, `EnglishProficiency`, `CurriculumTrack`, `CustodyArrangement`, `PrimaryContactParent`, `AuthorizedPickupPersons`, `MediaConsent`, `DietaryRequirements`, `Allergies`, `InsuranceProvider`, `InsurancePolicyExpiry`, `HouseName`, `AdmissionType`, `ConcessionPercent`, `SpecialNeeds`

## Parents (32 legacy columns)

`ID`, `FullName`, `Email`, `Mobile`, `PasswordHash`, `Relation`, `Occupation`, `Address`, `LastLogin`, `Status`, `IsDeleted`, `CreatedAt`, `UpdatedAt`, `Nationality`, `CountryOfResidence`, `PreferredLanguage`, `PreferredContactMethod`, `WhatsAppNumber`, `TimeZone`, `Employer`, `JobTitle`, `WorkEmail`, `WorkPhone`, `PreferredBillingContact`, `NotificationPreferences`, `EmergencyOnly`, `PhotoURL`, `City`, `Country`, `PostalCode`, `NumberOfChildren`, `AnnualIncome`

## Parent_Students (6 legacy columns)

`ID`, `ParentID`, `StudentID`, `IsPrimaryContact`, `CreatedAt`, `UpdatedAt`
