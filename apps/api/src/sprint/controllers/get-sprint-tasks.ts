import { and, asc, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import {
  projectTable,
  sprintTable,
  taskTable,
  userTable,
} from "../../database/schema";

/** The tasks finished in one closed sprint, grouped by project in order. */
async function getSprintTasks(workspaceId: string, sprintId: string) {
  const [sprint] = await db
    .select({ id: sprintTable.id })
    .from(sprintTable)
    .where(
      and(
        eq(sprintTable.id, sprintId),
        eq(sprintTable.workspaceId, workspaceId),
      ),
    )
    .limit(1);

  if (!sprint) {
    throw new HTTPException(404, { message: "Sprint not found" });
  }

  return db
    .select({
      id: taskTable.id,
      number: taskTable.number,
      title: taskTable.title,
      status: taskTable.status,
      projectId: projectTable.id,
      projectName: projectTable.name,
      projectSlug: projectTable.slug,
      userId: taskTable.userId,
      assigneeName: userTable.name,
      carryOverCount: taskTable.carryOverCount,
    })
    .from(taskTable)
    .innerJoin(projectTable, eq(taskTable.projectId, projectTable.id))
    .leftJoin(userTable, eq(taskTable.userId, userTable.id))
    .where(
      and(
        eq(taskTable.sprintId, sprintId),
        eq(projectTable.workspaceId, workspaceId),
      ),
    )
    .orderBy(asc(projectTable.name), asc(taskTable.number));
}

export default getSprintTasks;
