"use client";

import {
  useState,
  type CSSProperties,
  type InputHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { Icon, type IconName } from "./Icon";

type BaseProps = {
  label?: string;
  hint?: string;
  error?: string;
  icon?: IconName;
  /** Stil på ytre <label>-elementet, ikke på selve feltet. */
  style?: CSSProperties;
};

type SingleLineProps = BaseProps & {
  multiline?: false;
} & Omit<InputHTMLAttributes<HTMLInputElement>, "style">;

type MultiLineProps = BaseProps & {
  multiline: true;
  rows?: number;
} & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "style" | "rows">;

export type InputProps = SingleLineProps | MultiLineProps;

function fieldStyle(opts: {
  focus: boolean;
  error?: string;
  multiline?: boolean;
  icon?: IconName;
}): CSSProperties {
  const { focus, error, multiline, icon } = opts;
  return {
    width: "100%",
    fontFamily: "var(--font-body)",
    fontSize: 15,
    color: "var(--text-heading)",
    background: "var(--white)",
    border: `1px solid ${
      error
        ? "var(--status-danger-fg)"
        : focus
          ? "var(--border-brand)"
          : "var(--border-subtle)"
    }`,
    borderRadius: "var(--radius-sm)",
    padding: multiline ? "12px 14px" : icon ? "0 14px 0 42px" : "0 14px",
    height: multiline ? "auto" : 46,
    outline: "none",
    boxShadow: focus ? "0 0 0 3px var(--focus-ring)" : "none",
    transition: "var(--transition-base)",
  };
}

export function Input(props: InputProps) {
  const [focus, setFocus] = useState(false);
  const { label, hint, error, icon, style } = props;
  const multiline = props.multiline === true;

  const shell = fieldStyle({ focus, error, multiline, icon });

  let field;
  if (props.multiline) {
    const { label: _l, hint: _h, error: _e, icon: _i, style: _s, multiline: _m, rows = 4, ...rest } = props;
    field = (
      <textarea
        rows={rows}
        {...rest}
        onFocus={() => setFocus(true)}
        onBlur={() => setFocus(false)}
        style={shell}
      />
    );
  } else {
    const { label: _l, hint: _h, error: _e, icon: _i, style: _s, multiline: _m, type = "text", ...rest } = props;
    field = (
      <input
        type={type}
        {...rest}
        onFocus={() => setFocus(true)}
        onBlur={() => setFocus(false)}
        style={shell}
      />
    );
  }

  return (
    <label style={{ display: "block", ...style }}>
      {label ? (
        <span
          style={{
            display: "block",
            marginBottom: 6,
            fontSize: 14,
            fontWeight: "var(--weight-semibold)" as unknown as number,
            color: "var(--text-heading)",
          }}
        >
          {label}
        </span>
      ) : null}
      <span style={{ position: "relative", display: "block" }}>
        {icon && !multiline ? (
          <Icon
            name={icon}
            size={18}
            style={{
              position: "absolute",
              left: 14,
              top: 14,
              color: "var(--grey-400)",
            }}
          />
        ) : null}
        {field}
      </span>
      {error ? (
        <span
          style={{
            display: "block",
            marginTop: 6,
            fontSize: 13,
            color: "var(--status-danger-fg)",
          }}
        >
          {error}
        </span>
      ) : hint ? (
        <span
          style={{
            display: "block",
            marginTop: 6,
            fontSize: 13,
            color: "var(--text-muted)",
          }}
        >
          {hint}
        </span>
      ) : null}
    </label>
  );
}

export default Input;
