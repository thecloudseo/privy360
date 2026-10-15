import { useId, type ReactNode } from "react";

export type CardProps = {
  title?: string;
  headingLevel?: 2 | 3 | 4;
  actions?: ReactNode;
  className?: string;
  children: ReactNode;
};

export function Card({
  title,
  headingLevel = 2,
  actions,
  className,
  children,
}: CardProps) {
  const titleId = useId();
  const Heading = `h${headingLevel}` as "h2" | "h3" | "h4";
  const classes = ["p360-card", className].filter(Boolean).join(" ");
  return (
    <section className={classes} aria-labelledby={title ? titleId : undefined}>
      {title || actions ? (
        <header className="p360-card__header">
          {title ? (
            <Heading id={titleId} className="p360-card__title">
              {title}
            </Heading>
          ) : null}
          {actions ? <div className="p360-card__actions">{actions}</div> : null}
        </header>
      ) : null}
      <div className="p360-card__body">{children}</div>
    </section>
  );
}
