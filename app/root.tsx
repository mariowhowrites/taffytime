import {
  Form,
  json,
  Link,
  Links,
  LiveReload,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLoaderData,
} from "remix";
import type { LinksFunction, MetaFunction, LoaderFunction } from "remix";

import tailwindStylesheetUrl from "./styles/tailwind.css";
import { getUser } from "./session.server";

export const links: LinksFunction = () => {
  return [{ rel: "stylesheet", href: tailwindStylesheetUrl }];
};

export const meta: MetaFunction = () => ({
  charset: "utf-8",
  title: "TaffyTime Pomodoro Timer",
  viewport: "width=device-width,initial-scale=1",
});

type LoaderData = {
  user: Awaited<ReturnType<typeof getUser>>;
};

export const loader: LoaderFunction = async ({ request }) => {
  return json<LoaderData>({
    user: await getUser(request),
  });
};

export default function App() {
  const { user } = useLoaderData<LoaderData>();

  return (
    <html lang="en" className="h-full">
      <head>
        <Meta />
        <Links />
      </head>
      <body className="h-full">
        <main className="h-full max-h-screen w-screen">
          <div className="flex h-full w-full flex-col bg-zinc-900 px-5">
            <aside className="flex justify-between py-4 text-white">
              <Link
                to={{
                  pathname: "/",
                }}
              >
                TaffyTime
              </Link>
              <div className="flex gap-2">
                {user !== null ? (
                  <>
                    <Link
                      to={{
                        pathname: "/profile",
                      }}
                    >
                      Profile
                    </Link>
                    <Form action="/logout" method="post">
                      <button className="text-white">Logout</button>
                    </Form>
                  </>
                ) : (
                  <>
                    <Link to={{ pathname: "/login" }}>Login</Link>
                    <Link to={{ pathname: "/join" }}>Join</Link>
                  </>
                )}
              </div>
            </aside>
            <Outlet />
          </div>
        </main>
        <ScrollRestoration />
        <Scripts />
        <LiveReload />
      </body>
    </html>
  );
}
