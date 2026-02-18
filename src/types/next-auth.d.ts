import "next-auth";

declare module "next-auth" {
  interface User {
    id: string;
    organizationId?: string;
  }

  interface Session {
    user: User & {
      id: string;
      organizationId?: string;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    organizationId?: string;
  }
}
