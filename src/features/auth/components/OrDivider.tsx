/**
 * `OrDivider` — the rule-word-rule separator between a form's own submit and the alternative ways in.
 *
 * It is a component rather than three lines inlined twice because the login and signup screens must not
 * be able to disagree about it: the same word, the same weight, the same air above and below. That is
 * the whole content of [Rule 1](../../../../CLAUDE.md) at its smallest scale.
 *
 * Lowercase "or", not "OR" and not "— or —". The separator's job is to be read once and then ignored;
 * anything louder competes with the two real controls it sits between.
 */
import { createStyles, Divider, Stack, Text } from '@/core/design-system';

const useStyles = createStyles(() => ({
  /**
   * `flex: 1` on each rule so the word stays centred whatever the container's width. Not a spacing
   * token — `flex` is a layout ratio, and the design language has nothing to say about it.
   */
  rule: { flex: 1 },
}));

export function OrDivider() {
  const styles = useStyles();

  return (
    <Stack direction="row" align="center" gap="md">
      <Divider tone="subtle" style={styles.rule} />
      <Text variant="footnote" tone="tertiary">
        or
      </Text>
      <Divider tone="subtle" style={styles.rule} />
    </Stack>
  );
}
