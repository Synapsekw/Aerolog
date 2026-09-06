export function Status({ children }: { children: string }) {
  return (
    <span
      className={
        'status ' +
        (String(children).match(
          /Pending|Review|due|Attention|Quarantined|Overdue|Changes|Unverified/,
        )
          ? 'amber'
          : String(children).match(
                /Draft|Disconnected|Retired|Inactive|Unavailable|Disabled/,
              )
            ? 'gray'
            : 'green')
      }
    >
      <i />
      {children}
    </span>
  );
}
