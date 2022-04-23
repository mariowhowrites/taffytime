import {
  ActionFunction,
  Form,
  json,
  LoaderFunction,
  redirect,
  useActionData,
  useLoaderData,
} from "remix";
import { updateUserIntervalDuration } from "~/models/user.server";
import { getWorkSessions } from "~/models/work-session.server";
import { requireUser } from "~/session.server";

interface LoaderData {
  workSessions: Awaited<ReturnType<typeof getWorkSessions>>;
  user: Awaited<ReturnType<typeof requireUser>>;
}

interface ActionData {
  errors?: {
    intervalDuration?: string;
  };
}

export const action: ActionFunction = async ({ request }) => {
  const user = await requireUser(request);
  const formData = await request.formData();
  const intervalDuration = formData.get("intervalDuration");

  if (intervalDuration === null) {
    return json<ActionData>(
      {
        errors: {
          intervalDuration: "Must provide an interval duration",
        },
      },
      { status: 400 }
    );
  }

  const duration = Number(intervalDuration);

  if (duration <= 0) {
    return json<ActionData>(
      {
        errors: {
          intervalDuration: "Interval duration must be a positive number",
        },
      },
      { status: 400 }
    );
  }

  // we have validated our input
  // let's make the change
  await updateUserIntervalDuration(user, duration);

  return redirect("/");
};

export const loader: LoaderFunction = async ({ request }) => {
  const user = await requireUser(request);
  const workSessions = await getWorkSessions({ userId: user.id });
  return json<LoaderData>({ workSessions, user });
};

export default function ProfilePage() {
  const actionData = useActionData<ActionData>();
  const { workSessions, user } = useLoaderData<LoaderData>();

  const totalSecondsSpent = workSessions.reduce(
    (totalSeconds, { duration }) => totalSeconds + duration,
    0
  );

  

  return (
    <div className="mx-auto w-3/5">
      <div className="flex h-full flex-col justify-center text-white">
        <section id="aboutSection" className="mb-16">
          <h2 className="mb-4 text-4xl font-bold">About</h2>
          <p>Email: {user.email}</p>
          <p>Total seconds spent: {totalSecondsSpent}s</p>
        </section>
        <section id="settingsSection">
          <Form method="post">
            <h2 className="mb-4 text-4xl font-bold">Settings</h2>
            <div className="mb-4">
              <label
                htmlFor="intervalDuration"
                className="block text-sm font-medium text-white"
              >
                Interval Duration
              </label>
              <div className="mt-1">
                <input
                  id="intervalDuration"
                  required
                  name="intervalDuration"
                  defaultValue={String(user.intervalDuration)}
                  type="number"
                  aria-invalid={
                    actionData?.errors?.intervalDuration ? true : undefined
                  }
                  aria-describedby="interval-error"
                  className="rounded border border-gray-500 px-2 py-1 text-lg text-gray-700"
                />
                {actionData?.errors?.intervalDuration && (
                  <div className="pt-1 text-red-700" id="interval-error">
                    {actionData.errors.intervalDuration}
                  </div>
                )}
              </div>
            </div>
            <button
              type="submit"
              className="rounded bg-blue-500 py-2 px-4 text-white hover:bg-blue-600 focus:bg-blue-400"
            >
              Submit
            </button>
          </Form>
        </section>
      </div>
    </div>
  );
}

/**
 * two options for storing user settings
 *
 * 1) we can store in the users table
 * 2) we can store in a separate table in a 1-1 matchup
 */
