import { User } from "@prisma/client";
import { useMemo, useState } from "react";
import { ActionFunction, json, LoaderFunction, useLoaderData, useSubmit } from "remix";
import { createWorkSession } from "~/models/work-session.server";
import { getUser, getUserId } from "~/session.server";

// the timer duration in minutes
const defaultTimerDuration = 25;

interface LoaderData {
  user: User | null;
}

enum TimerStates {
  READY = "READY",
  WORKING = "WORKING",
  PAUSED = "PAUSED",
  BREAKING = "BREAKING"
}

export const loader: LoaderFunction = async ({ request }) => {
  return json<LoaderData>({
    user: await getUser(request)
  })
};

// action functions handle POST requests from our webpage
export const action: ActionFunction = async ({ request }) => {
  const userId = await getUserId(request);
  if (userId === undefined) {
    return {};
  }

  const formData = await request.formData();

  let duration = formData.get("duration") as string;

  if (!duration) {
    throw new Error("duration cannot be 0");
  }

  let writing = formData.get("writing") as string;

  // validate writing here, make sure there's at least 1 character

  const workSession = await createWorkSession({
    userId,
    duration: parseInt(duration, 10),
    completedCycles: 0,
    writing
  });

  return json({ duration: workSession.duration });
};

export default function Index() {
  const { user } = useLoaderData<LoaderData>();
  // timerEnd = date (25 min in the future)
  // timer = timerEnd - now

  const submit = useSubmit();

  const [writing, setWriting] = useState('');

  const onWritingChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    // handle saving writing here
  }

  const [timerIntervalID, setTimerIntervalID] = useState<NodeJS.Timer | null>(
    null
  );
  const [isInWorkSession, setIsInWorkSession] = useState(false);

  const [minutesValue, setMinutesValue] = useState(user ? user.intervalDuration : defaultTimerDuration);
  const [secondsValue, setSecondsValue] = useState(60);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const onStartTimer = () => {
    setIsInWorkSession(true);

    startTimer();
  };

  const startTimer = () => {
    setTimerIntervalID(
      setInterval(() => {
        setSecondsValue((seconds) => {
          let newSeconds = seconds - 1;

          if (newSeconds === -1) {
            newSeconds = 59;
          }

          if (newSeconds === 59) {
            setMinutesValue((minutes) => minutes - 1);
          }

          return newSeconds;
        });

        setElapsedSeconds((seconds) => seconds + 1);
      }, 1000)
    );
  };

  const secondsLeftString = useMemo(() => {
    return secondsValue === 60
      ? "00"
      : secondsValue.toString().padStart(2, "0");
  }, [secondsValue]);

  const onPauseTimer = () => {
    if (timerIntervalID !== null) {
      clearInterval(timerIntervalID);
      setTimerIntervalID(null);
    }
  };

  const onResumeTimer = () => {
    startTimer();
  };

  const onStopTimer = () => {
    onPauseTimer();

    setMinutesValue(user ? user.intervalDuration : defaultTimerDuration);
    setSecondsValue(60);

    setIsInWorkSession(false);

    const formData = new FormData();
    formData.append("duration", elapsedSeconds.toString());
    formData.append("writing", writing);
    submit(formData, { method: "post" });
  };

  return (
    <div className="flex w-full grow flex-col items-center justify-center">
      <div className="flex h-1/2 items-end">
        <p className="pb-4 text-9xl text-white">
          {minutesValue}:{secondsLeftString}
        </p>
      </div>
      <div className="flex h-1/2 flex-col gap-4">
        {timerIntervalID == undefined ? (
          isInWorkSession ? (
            <button
              className="hover:bg-shadow-xl rounded-2xl bg-green-500 px-4 py-2 font-bold text-white shadow hover:bg-green-700"
              onClick={onResumeTimer}
            >
              Resume Timer!
            </button>
          ) : (
            <button
              className="hover:bg-shadow-xl rounded-2xl bg-green-500 px-4 py-2 font-bold text-white shadow hover:bg-green-700"
              onClick={onStartTimer}
            >
              Start Timer!
            </button>
          )
        ) : (
          <>
            <button
              className="hover:bg-shadow-xl rounded-2xl bg-red-600 px-4 py-2 font-bold text-white shadow hover:bg-red-800"
              onClick={onPauseTimer}
            >
              Pause Timer!
            </button>
          </>
        )}
        {isInWorkSession ? (
          <button
            className="hover:bg-shadow-xl rounded-2xl bg-red-600 px-4 py-2 font-bold text-white shadow hover:bg-red-800"
            onClick={onStopTimer}
          >
            Stop Timer!
          </button>
        ) : null}
        {/* textarea goes somewhere around here */}
        <textarea onChange={onWritingChange}></textarea>
      </div>
    </div>
  );
}
