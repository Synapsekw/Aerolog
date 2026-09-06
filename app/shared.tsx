export function Status({ children }: { children: string }) {
  return (
    <span
      className={
        'status ' +
        (String(children).match(
          /Pending|Review|due|Attention|Quarantined|Overdue|Changes/,
        )
          ? 'amber'
          : String(children).match(
                /Draft|Disconnected|Retired|Inactive|Unavailable/,
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
