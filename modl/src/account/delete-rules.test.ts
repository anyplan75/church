import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ACCOUNT_DELETE_CONFIRM, accountDeleteConfirmError } from "@/account/delete-rules";

describe("계정 삭제 확인", () => {
  it("확인 문장이 같아야 지울 수 있습니다", () => {
    assert.equal(accountDeleteConfirmError(ACCOUNT_DELETE_CONFIRM), null);
    assert.equal(accountDeleteConfirmError(`  ${ACCOUNT_DELETE_CONFIRM}  `), null);
  });

  it("빈 칸이나 다른 말은 막습니다", () => {
    assert.match(accountDeleteConfirmError("") ?? "", /확인 칸/);
    assert.match(accountDeleteConfirmError("삭제") ?? "", /확인 칸/);
    assert.match(accountDeleteConfirmError("계정을 삭제") ?? "", /확인 칸/);
  });
});
