export type CurrentUserResponse = {
  user: {
    id: string;
    fullName: string;
    email: string | null;
    rollNumber: string | null;
    phone: string | null;
    programme: string | null;
    zone: string | null;
    schoolName: string | null;
    status: string;
  };
  role: {
    code: string;
    name: string;
    dashboardPath: string;
  };
  permissions: string[];
  modules: Array<{
    code: string;
    name: string;
    permissions: Array<{
      code: string;
      name: string;
      grantedBy: string;
    }>;
  }>;
};

export type SignInPayload = {
  identifier: string;
  password: string;
};

export type SignUpPayload = {
  fullName: string;
  email?: string;
  rollNumber?: string;
  phone?: string;
  programme?: string;
  zone?: string;
  schoolName?: string;
  roleCode: string;
  password: string;
  confirmPassword: string;
};

export type SignInResponse = {
  accessToken: string;
  tokenType: "Bearer";
  expiresIn: number;
  role: {
    code: string;
    name: string;
    dashboardPath: string;
  };
  user: {
    id: string;
    fullName: string;
    email: string | null;
    rollNumber: string | null;
    status: string;
  };
};

export type SignUpResponse = {
  message: string;
  userId: string | null;
  role: {
    code: string;
    name: string;
  };
};
