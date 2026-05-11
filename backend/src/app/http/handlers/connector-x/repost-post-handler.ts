import { AppError } from "../../../../core/errors/app-error";
import { err, ok, type Result } from "../../../../core/result/result";
import type { RepostPost } from "../../../../modules/connector-x/application/commands/repost-post";

export async function repostPostHandler(
  command: RepostPost,
  input: { account_id: string; target_post_id: string },
): Promise<Result<{
  connector_request_id: string;
  target_post_id: string;
  reposted: boolean;
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
