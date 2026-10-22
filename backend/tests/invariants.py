import os
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

SQL_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "scripts", "check_invariants.sql")

async def assert_invariants(session: AsyncSession) -> None:
    """Executes the invariant audit SQL script against the database session.
    Fails with AssertionError if any invariant is violated.
    """
    with open(SQL_PATH, "r", encoding="utf-8") as f:
        sql = f.read()

    # The SQL script has multiple queries combined with UNION ALL
    # or standalone statements. We execute the combined audit query.
    result = await session.execute(text(sql))
    violations = result.mappings().all()

    if violations:
        violation_details = "\n".join(
            f"[{row['violation_type']}] Entity: {row['entity_id']} | Detail: {row['detail']}"
            for row in violations
        )
        raise AssertionError(
            f"DATABASE INVARIANT AUDIT FAILED with {len(violations)} violation(s):\n{violation_details}"
        )
