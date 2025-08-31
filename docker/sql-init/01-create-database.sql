-- Create the database
IF NOT EXISTS (SELECT * FROM sys.databases WHERE name = 'EmpathySoupKitchen')
BEGIN
    CREATE DATABASE EmpathySoupKitchen;
END
GO

USE EmpathySoupKitchen;
GO

-- Create VolunteerShifts table
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='VolunteerShifts' and xtype='U')
BEGIN
    CREATE TABLE dbo.VolunteerShifts (
        ShiftID INT IDENTITY(1,1) PRIMARY KEY,
        StartTime DATETIME2(7) NOT NULL,
        EndTime DATETIME2(7) NOT NULL,
        Capacity INT NOT NULL,
        CreatedAt DATETIME2(7) DEFAULT GETUTCDATE(),
        UpdatedAt DATETIME2(7) DEFAULT GETUTCDATE()
    );
END
GO

-- Create SignUps table
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='SignUps' and xtype='U')
BEGIN
    CREATE TABLE dbo.SignUps (
        SignUpID INT IDENTITY(1,1) PRIMARY KEY,
        ShiftID INT NOT NULL,
        Name NVARCHAR(100) NOT NULL,
        Email NVARCHAR(255) NOT NULL,
        PhoneNumber NVARCHAR(20) NOT NULL,
        NumPeople INT NOT NULL DEFAULT 1,
        CreatedAt DATETIME2(7) DEFAULT GETUTCDATE(),
        UpdatedAt DATETIME2(7) DEFAULT GETUTCDATE(),
        FOREIGN KEY (ShiftID) REFERENCES dbo.VolunteerShifts(ShiftID) ON DELETE CASCADE
    );
END
GO

-- Create TextBoxes table
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='TextBoxes' and xtype='U')
BEGIN
    CREATE TABLE dbo.TextBoxes (
        ID INT IDENTITY(1,1) PRIMARY KEY,
        TextName NVARCHAR(100) NOT NULL UNIQUE,
        TextContent NVARCHAR(MAX),
        CreatedAt DATETIME2(7) DEFAULT GETUTCDATE(),
        UpdatedAt DATETIME2(7) DEFAULT GETUTCDATE()
    );
END
GO

-- Insert sample data
-- Insert volunteer instructions
IF NOT EXISTS (SELECT 1 FROM dbo.TextBoxes WHERE TextName = 'VolunteerInstructions')
BEGIN
    INSERT INTO dbo.TextBoxes (TextName, TextContent) VALUES
    ('VolunteerInstructions', '"Welcome to the Empathy Soup Kitchen volunteer portal! Please review the available shifts and sign up for those that fit your schedule. We appreciate your service to the community. If you have any questions, please contact us at volunteer@empathysoupkitchen.org."');
END
GO

-- Insert sample volunteer shifts (next few weekends)
DECLARE @NextSaturday DATETIME2;
SET @NextSaturday = DATEADD(DAY, (6 - DATEPART(WEEKDAY, GETDATE()) + 7) % 7, CAST(CAST(GETDATE() AS DATE) AS DATETIME2));
SET @NextSaturday = DATEADD(HOUR, 9, @NextSaturday); -- 9 AM

-- Insert shifts for the next 4 weeks (Saturday and Sunday)
DECLARE @WeekOffset INT = 0;
WHILE @WeekOffset < 4
BEGIN
    DECLARE @SaturdayStart DATETIME2 = DATEADD(WEEK, @WeekOffset, @NextSaturday);
    DECLARE @SaturdayEnd DATETIME2 = DATEADD(HOUR, 3, @SaturdayStart); -- 9 AM - 12 PM
    DECLARE @SundayStart DATETIME2 = DATEADD(DAY, 1, @SaturdayStart); -- Sunday 9 AM
    DECLARE @SundayEnd DATETIME2 = DATEADD(HOUR, 3, @SundayStart); -- Sunday 12 PM

    -- Saturday shift
    IF NOT EXISTS (SELECT 1 FROM dbo.VolunteerShifts WHERE StartTime = @SaturdayStart)
    BEGIN
        INSERT INTO dbo.VolunteerShifts (StartTime, EndTime, Capacity) VALUES
        (@SaturdayStart, @SaturdayEnd, 8);
    END

    -- Sunday shift  
    IF NOT EXISTS (SELECT 1 FROM dbo.VolunteerShifts WHERE StartTime = @SundayStart)
    BEGIN
        INSERT INTO dbo.VolunteerShifts (StartTime, EndTime, Capacity) VALUES
        (@SundayStart, @SundayEnd, 6);
    END

    SET @WeekOffset = @WeekOffset + 1;
END
GO

-- Add some sample signups for testing
DECLARE @FirstShiftID INT = (SELECT TOP 1 ShiftID FROM dbo.VolunteerShifts ORDER BY StartTime);

IF @FirstShiftID IS NOT NULL AND NOT EXISTS (SELECT 1 FROM dbo.SignUps WHERE ShiftID = @FirstShiftID)
BEGIN
    INSERT INTO dbo.SignUps (ShiftID, Name, Email, PhoneNumber, NumPeople) VALUES
    (@FirstShiftID, 'John Doe', 'john.doe@example.com', '(555) 123-4567', 1),
    (@FirstShiftID, 'Jane Smith', 'jane.smith@example.com', '(555) 987-6543', 2);
END
GO

PRINT 'Database initialization completed successfully!';
GO