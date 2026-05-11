import { AppError } from "../../../../core/errors/app-error";
import { err, ok, type Result } from "../../../../core/result/result";
import type { LookupPosts } from "../../../../modules/connector-x/application/commands/lookup-posts";

export async function lookupPostsHandler(
  command: LookupPosts,
  input: { account_id: string; post_ids: string[] },
): Promise<Result<{
  posts: Array<{
    external_post_id: string;
    handle: string;
    content: string;
    occurred_at: string;
  }>;
}>> {
  try {
    return ok(await command.execute(input));
  } catch (error) {
    if (error instanceof AppError) {
      return err(error);
    }

    throw error;
  }
}
