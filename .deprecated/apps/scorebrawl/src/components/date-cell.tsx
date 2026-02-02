"use client";

export const DateCell = ({ date }: { date: Date }) => {
  return <div>{date.toLocaleDateString(window.navigator.language)}</div>;
};
