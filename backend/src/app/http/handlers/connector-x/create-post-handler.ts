import { AppError } from "../../../../core/errors/app-error";
import { err, ok, type Result } from "../../../../core/result/result";
import type { CreatePost } from "../../../../modules/connector-x/application/commands/create-post";

export async function createPostHandler(
  command: CreatePost,
  input: { account_id: string; text: string },
): Promise<Result<{ connector_request_id: string; external_post_id: string; external_post_url?: string }>> {
  try {
    return ok(await command.execute(input));
  } catch (error) {
    if (error instanceof AppError) {
      return err(error);
    }

    throw error;
  }
}
