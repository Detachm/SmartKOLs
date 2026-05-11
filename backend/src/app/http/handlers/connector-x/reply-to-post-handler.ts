import { AppError } from "../../../../core/errors/app-error";
import { err, ok, type Result } from "../../../../core/result/result";
import type { ReplyToPost } from "../../../../modules/connector-x/application/commands/reply-to-post";

export async function replyToPostHandler(
  command: ReplyToPost,
  input: { account_id: string; reply_to_external_post_id: string; text: string },
): Promise<Result<{
  connector_request_id: string;
  external_reply_id: string;
  external_reply_url?: string;
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
