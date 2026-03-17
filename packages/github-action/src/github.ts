import * as github from "@actions/github";

export interface GitHubClient {
  postComment(body: string): Promise<void>;
  setCommitStatus(state: "success" | "failure", description: string): Promise<void>;
}

export function createGitHubClient(token: string): GitHubClient {
  const octokit = github.getOctokit(token);
  const context = github.context;
  const { owner, repo } = context.repo;
  const prNumber = context.payload.pull_request?.number;
  const sha = context.payload.pull_request?.head?.sha ?? context.sha;

  return {
    async postComment(body: string): Promise<void> {
      if (!prNumber) {
        throw new Error("Not running in a pull request context");
      }

      // Look for existing Pocolente comment to update
      const { data: comments } = await octokit.rest.issues.listComments({
        owner, repo, issue_number: prNumber, per_page: 100,
      });

      const existing = comments.find(
        (c) => c.user?.type === "Bot" && c.body?.includes("Pocolente QA"),
      );

      if (existing) {
        await octokit.rest.issues.updateComment({
          owner, repo, comment_id: existing.id, body,
        });
      } else {
        await octokit.rest.issues.createComment({
          owner, repo, issue_number: prNumber, body,
        });
      }
    },

    async setCommitStatus(state: "success" | "failure", description: string): Promise<void> {
      await octokit.rest.repos.createCommitStatus({
        owner, repo, sha, state, description, context: "Pocolente QA",
      });
    },
  };
}
