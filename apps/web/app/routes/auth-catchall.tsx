import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { createAuth } from "~/lib/auth/auth-server";

export async function loader({ request, context }: LoaderFunctionArgs) {
  const auth = createAuth(context.cloudflare.env.DB, context.cloudflare.env);
  return auth.handler(request);
}

export async function action({ request, context }: ActionFunctionArgs) {
  const auth = createAuth(context.cloudflare.env.DB, context.cloudflare.env);
  return auth.handler(request);
}
