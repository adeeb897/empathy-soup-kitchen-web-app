-- ============================================
-- Empathy Soup Kitchen — Database Schema
-- Column names match the Angular service contracts exactly
-- so DAB auto-mapping works without field overrides.
--
-- This script is IDEMPOTENT: every object is guarded, so it is safe to
-- run repeatedly. It is executed automatically on each `az deployment
-- group create` by the runSchema deploymentScript in main.bicep.
--
-- Keep it that way — guard anything you add, and never write a bare
-- CREATE/ALTER, or deployments will start failing on the second run.
-- ============================================

-- ─── Volunteer Shifts ───────────────────────────────────────────────
IF OBJECT_ID('dbo.VolunteerShifts', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.VolunteerShifts (
        ShiftID     INT IDENTITY(1,1) PRIMARY KEY,
        StartTime   DATETIME2      NOT NULL,
        EndTime     DATETIME2      NOT NULL,
        Capacity    INT            NOT NULL DEFAULT 10
    );
END
GO

-- ─── Sign-Ups ───────────────────────────────────────────────────────
IF OBJECT_ID('dbo.SignUps', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.SignUps (
        SignUpID        INT IDENTITY(1,1) PRIMARY KEY,
        ShiftID         INT            NOT NULL,
        Name            NVARCHAR(200)  NOT NULL,
        Email           NVARCHAR(200)  NOT NULL,
        PhoneNumber     NVARCHAR(50)   NULL,
        NumPeople       INT            NOT NULL DEFAULT 1,
        ReminderSent    BIT            NOT NULL DEFAULT 0,
        CONSTRAINT FK_SignUps_Shift FOREIGN KEY (ShiftID) REFERENCES dbo.VolunteerShifts(ShiftID)
    );
END
GO

-- ─── Configurable Text Boxes ────────────────────────────────────────
IF OBJECT_ID('dbo.TextBoxes', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.TextBoxes (
        ID          INT IDENTITY(1,1) PRIMARY KEY,
        TextName    NVARCHAR(100)  NOT NULL UNIQUE,
        TextContent NVARCHAR(MAX)  NOT NULL
    );
END
GO

-- ─── Pledges (from the public pledge form) ──────────────────────────
-- NOTE: served by /api/pledges, which is an anonymous Function like
-- /api/signups. An unauthenticated GET returns every row, including
-- donor contact details.
IF OBJECT_ID('dbo.Pledges', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.Pledges (
        PledgeID        INT IDENTITY(1,1) PRIMARY KEY,
        Amount          DECIMAL(10,2)  NOT NULL DEFAULT 0,
        AmountLabel     NVARCHAR(100)  NULL,
        Name            NVARCHAR(200)  NOT NULL,
        Email           NVARCHAR(200)  NOT NULL,
        PhoneNumber     NVARCHAR(50)   NULL,
        Address         NVARCHAR(400)  NULL,
        VolunteerInterest NVARCHAR(50) NULL,
        Frequency       NVARCHAR(100)  NULL,
        Timing          NVARCHAR(100)  NULL,
        PaymentMethod   NVARCHAR(50)   NULL,
        Notes           NVARCHAR(MAX)  NULL,
        SubmittedAt     DATETIME2      NOT NULL DEFAULT SYSUTCDATETIME()
    );
END
GO

-- ─── Indexes ────────────────────────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_SignUps_ShiftID' AND object_id = OBJECT_ID('dbo.SignUps'))
    CREATE INDEX IX_SignUps_ShiftID ON dbo.SignUps(ShiftID);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_SignUps_Email' AND object_id = OBJECT_ID('dbo.SignUps'))
    CREATE INDEX IX_SignUps_Email ON dbo.SignUps(Email);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_VolunteerShifts_StartTime' AND object_id = OBJECT_ID('dbo.VolunteerShifts'))
    CREATE INDEX IX_VolunteerShifts_StartTime ON dbo.VolunteerShifts(StartTime);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_TextBoxes_TextName' AND object_id = OBJECT_ID('dbo.TextBoxes'))
    CREATE INDEX IX_TextBoxes_TextName ON dbo.TextBoxes(TextName);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Pledges_SubmittedAt' AND object_id = OBJECT_ID('dbo.Pledges'))
    CREATE INDEX IX_Pledges_SubmittedAt ON dbo.Pledges(SubmittedAt);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Pledges_Email' AND object_id = OBJECT_ID('dbo.Pledges'))
    CREATE INDEX IX_Pledges_Email ON dbo.Pledges(Email);
GO
