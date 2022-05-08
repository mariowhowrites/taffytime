import { User } from "@prisma/client";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActionFunction,
  json,
  LoaderFunction,
  useLoaderData,
  useSubmit,
} from "remix";
import { useEffectReducer } from "use-effect-reducer";
import { createWorkSession } from "~/models/work-session.server";
import { getUser, getUserId } from "~/session.server";
import { throttle } from "lodash";
import { useBackgroundColor } from "~/root";

// the timer duration in minutes
const defaultTimerDuration = 25;

interface LoaderData {
  user: User | null;
}

enum TimerStates {
  READY = "READY",
  WORKING = "WORKING",
  PAUSED = "PAUSED",
  BREAKING = "BREAKING",
  STOPPED = "STOPPED",
}

interface ReducerType {
  status: string;
}

interface EventType {
  type: keyof typeof TimerStates;
}

type ActionObject = {
  [key in TimerStates]: () => ReducerType;
};

const timerReducer = (state: ReducerType, event: EventType, exec) => {
  const possibleActions: ActionObject = {
    [TimerStates.READY]: () => {
      exec({ type: TimerStates.READY });

      return {
        status: TimerStates.READY,
      };
    },

    [TimerStates.WORKING]: () => {
      if (state.status === TimerStates.BREAKING) {
        exec({ type: TimerStates.READY });
      }

      exec({ type: TimerStates.WORKING });

      return {
        status: TimerStates.WORKING,
      };
    },

    [TimerStates.PAUSED]: () => {
      if (
        state.status !== TimerStates.WORKING &&
        state.status !== TimerStates.BREAKING
      ) {
        return state;
      }

      exec({ type: TimerStates.PAUSED });

      return {
        status: TimerStates.PAUSED,
      };
    },

    [TimerStates.BREAKING]: () => {
      if (state.status !== TimerStates.WORKING) {
        return state;
      }

      exec({ type: TimerStates.BREAKING });

      return {
        status: TimerStates.BREAKING,
      };
    },

    [TimerStates.STOPPED]: () => {
      exec({ type: TimerStates.STOPPED });
      exec({ type: TimerStates.READY });

      return {
        status: TimerStates.READY,
      };
    },
  };

  if (Object.keys(possibleActions).includes(event.type)) {
    return possibleActions[event.type]();
  }

  return state;
};

export default function Index() {
  const { user } = useLoaderData<LoaderData>();
  // timerEnd = date (25 min in the future)
  // timer = timerEnd - now
  const submit = useSubmit();
  const [writing, setWriting] = useState("");

  const onWritingChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    // handle saving writing here
  };

  const [timerIntervalID, setTimerIntervalID] = useState<NodeJS.Timer | null>(
    null
  );

  const [minutesValue, setMinutesValue] = useState(
    user ? user.intervalDuration : defaultTimerDuration
  );
  const [secondsValue, setSecondsValue] = useState(60);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const { setBackgroundColor } = useBackgroundColor();

  const startTimerInterval = () => {
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

        // we want this to be true EITHER
        // a) if the user is counting breaks in total time, OR
        // b) if they are not and we are working
        if (
          user?.breakTimeInTotalTime ||
          timerState.status === TimerStates.WORKING
        ) {
          setElapsedSeconds((seconds) => seconds + 1);
        }
      }, 1000)
    );
  };

  const stopTimerInterval = () => {
    if (timerIntervalID !== null) {
      clearInterval(timerIntervalID);
      setTimerIntervalID(null);
    }
  };

  const [timerState, dispatch] = useEffectReducer(
    timerReducer,
    { status: TimerStates.READY },
    {
      [TimerStates.READY]: () => {
        setMinutesValue(user ? user.intervalDuration : defaultTimerDuration);
        setSecondsValue(60);
      },

      [TimerStates.WORKING]: () => {
        stopTimerInterval();
        startTimerInterval();
      },

      [TimerStates.PAUSED]: () => {
        stopTimerInterval();
      },

      [TimerStates.BREAKING]: () => {
        setMinutesValue(5);
        setSecondsValue(60);

        stopTimerInterval();
        startTimerInterval();
      },

      [TimerStates.STOPPED]: () => {
        if (timerIntervalID !== null) {
          clearInterval(timerIntervalID);
          setTimerIntervalID(null);
        }

        const formData = new FormData();
        formData.append("duration", elapsedSeconds.toString());
        // change this when adding writing textarea
        // formData.append("writing", writing);
        submit(formData, { method: "post" });
      },
    }
  );

  const switchStates = useRef(
    throttle((state: ReducerType) => {
      const newState =
        state.status === TimerStates.BREAKING
          ? TimerStates.WORKING
          : TimerStates.BREAKING;

      dispatch({ type: newState });
    }, 500)
  );

  useEffect(() => {
    if (minutesValue === 0 && secondsValue === 0) {
      switchStates.current(timerState);

      setTimeout(() => switchStates.current.cancel(), 100);
    }
  }, [minutesValue, secondsValue, timerState, dispatch]);

  const secondsLeftString = useMemo(() => {
    return secondsValue === 60
      ? "00"
      : secondsValue.toString().padStart(2, "0");
  }, [secondsValue]);

  const statusEmoji = useMemo(() => {
    const statusEmojiMap = {
      [TimerStates.READY]: "🍬",
      [TimerStates.WORKING]: "🌱",
      [TimerStates.BREAKING]: "🌻",
      [TimerStates.PAUSED]: "🌆",
    };

    return statusEmojiMap[
      timerState.status as Exclude<keyof typeof TimerStates, "STOPPED">
    ];
  }, [timerState]);

  useEffect(() => {
    const statusBackgroundColorMap = {
      [TimerStates.READY]: "bg-sky-500",
      [TimerStates.WORKING]: "bg-pink-500",
      [TimerStates.BREAKING]: "bg-green-500",
      [TimerStates.PAUSED]: "bg-blue-600",
    };

    if (Object.keys(statusBackgroundColorMap).includes(timerState.status)) {
      setBackgroundColor(
        statusBackgroundColorMap[
          timerState.status as Exclude<keyof typeof TimerStates, "STOPPED">
        ]
      );
    }
  }, [setBackgroundColor, timerState]);

  return (
    <div className="flex w-full grow flex-col items-center justify-center">
      <div className="flex h-1/2 flex-col justify-end">
        <div className="text-center text-6xl">{statusEmoji}</div>
        <p className="mt-6 pb-4 text-9xl text-white">
          {minutesValue}:{secondsLeftString}
        </p>
      </div>
      <div className="flex h-1/2 flex-col gap-4">
        {timerState.status === TimerStates.READY ? (
          <button
            className="transition transition-200 hover:bg-shadow-xl rounded-2xl bg-green-500 px-4 py-2 font-bold text-white shadow hover:bg-green-700 shadow hover:shadow-lg"
            onClick={() => {
              dispatch({ type: TimerStates.READY });
              dispatch({ type: TimerStates.WORKING });
            }}
          >
            Start Timer!
          </button>
        ) : null}
        {timerState.status === TimerStates.WORKING ||
        timerState.status === TimerStates.BREAKING ? (
          <>
            <button
              className="transition transition-200 hover:bg-shadow-xl rounded-2xl bg-blue-600 px-4 py-2 font-bold text-white shadow hover:bg-blue-800 shadow hover:shadow-lg"
              onClick={() => dispatch({ type: TimerStates.PAUSED })}
            >
              Pause Timer!
            </button>
            <button
              className="transition transition-200 hover:bg-shadow-xl rounded-2xl bg-blue-600 px-4 py-2 font-bold text-white shadow hover:bg-blue-800 shadow hover:shadow-lg"
              onClick={() => dispatch({ type: TimerStates.STOPPED })}
            >
              Stop Timer!
            </button>
            <button
              className="transition transition-200 hover:bg-shadow-xl rounded-2xl bg-blue-600 px-4 py-2 font-bold text-white shadow hover:bg-blue-800 shadow hover:shadow-lg"
              onClick={() =>
                dispatch({
                  type:
                    timerState.status === TimerStates.WORKING
                      ? TimerStates.BREAKING
                      : TimerStates.WORKING,
                })
              }
            >
              Go to{" "}
              {timerState.status === TimerStates.WORKING ? "Break" : "Work"}!
            </button>
          </>
        ) : null}
        {timerState.status === TimerStates.PAUSED ? (
          <button
            className="hover:bg-shadow-xl rounded-2xl bg-green-500 px-4 py-2 font-bold text-white shadow hover:bg-green-700"
            onClick={() => dispatch({ type: TimerStates.WORKING })}
          >
            Resume Timer!
          </button>
        ) : null}
        {/* textarea goes somewhere around here */}
      </div>
    </div>
  );
}

// handles populating the opage for GET requests
export const loader: LoaderFunction = async ({ request }) => {
  return json<LoaderData>({
    user: await getUser(request),
  });
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
    // add writing variable here
  });

  return json({ duration: workSession.duration });
};
