import { User, WorkSession } from "@prisma/client";

import { prisma } from "~/db.server"

export function createWorkSession({
  userId,
  duration,
  completedCycles,
  // add writing arg here and update Pick type accordingly
}: Pick<WorkSession, "duration" | "completedCycles"> & {
  userId: User["id"]
}) {
  return prisma.workSession.create({
    data: {
      duration,
      completedCycles,
      user: {
        connect: {
          id: userId
        }
      }
    }
  })
}

export function getWorkSessions({ userId }: { userId: User["id"] }) {
  return prisma.workSession.findMany({
    where: { userId },
    select: { id: true, duration: true },
    orderBy: { duration: "desc" },
  })
}