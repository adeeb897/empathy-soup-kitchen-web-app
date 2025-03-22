export interface VolunteerShift {
  ShiftID: number;
  StartTime: string;
  EndTime: string;
  Capacity: number;
  signups: SignUp[];
}

export interface SignUp {
  SignUpID: number;
  ShiftID: number;
  Name: string;
  Email: string;
  PhoneNumber: string;
  NumPeople: number;
}
