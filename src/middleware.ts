import { withAuth } from "next-auth/middleware";

export default withAuth({
  pages: { signIn: "/login" },
});

export const config = {
  matcher: ["/", "/issues", "/feature-gen", "/prd", "/integration", "/settings"],
};
