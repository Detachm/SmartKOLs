import { AppError } from "../../../../core/errors/app-error";
import { err, ok, type Result } from "../../../../core/result/result";
import type { CommentOnPost } from "../../../../modules/connector-x/application/commands/comment-on-post";

export async function commentOnPostHandler(
  command: CommentOnPost,
  input: { account_id: string; comment_on_external_post_id: string; text: string },
): Promise<Result<{
  connector_request_id: string;
  external_comment_id: string;
  external_comment_url?: string;
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
