-- ============================================
-- Empathy Soup Kitchen — Database Schema
-- Column names match the Angular service contracts exactly
-- so DAB auto-mapping works without field overrides.
-- ============================================

-- Volunteer Shifts
CREATE TABLE dbo.VolunteerShifts (
    ShiftID     INT IDENTITY(1,1) PRIMARY KEY,
    StartTime   DATETIME2      NOT NULL,
    EndTime     DATETIME2      NOT NULL,
    Capacity    INT            NOT NULL DEFAULT 10
);

-- Sign-Ups
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

-- Configurable Text Boxes
CREATE TABLE dbo.TextBoxes (
    ID          INT IDENTITY(1,1) PRIMARY KEY,
    TextName    NVARCHAR(100)  NOT NULL UNIQUE,
    TextContent NVARCHAR(MAX)  NOT NULL
);

-- Indexes
CREATE INDEX IX_SignUps_ShiftID ON dbo.SignUps(ShiftID);
CREATE INDEX IX_SignUps_Email ON dbo.SignUps(Email);
CREATE INDEX IX_VolunteerShifts_StartTime ON dbo.VolunteerShifts(StartTime);
CREATE INDEX IX_TextBoxes_TextName ON dbo.TextBoxes(TextName);
