import { RemoteBlockedError } from "./errors.js";

const BLOCKER_DETAIL =
  "release repository is not connected and gh is not logged in. See docs/BLOCKERS.md B-001 / B-007.";

export function createRemoteAdapter() {
  return {
    async createPullRequest() {
      throw new RemoteBlockedError(BLOCKER_DETAIL);
    },
    async readCiResults() {
      throw new RemoteBlockedError(BLOCKER_DETAIL);
    },
  };
}
