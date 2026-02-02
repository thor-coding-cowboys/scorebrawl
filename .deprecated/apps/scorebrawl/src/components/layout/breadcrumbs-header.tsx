"use client";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import Link from "next/link";
import type { ReactNode } from "react";
import React from "react";
import { Separator } from "../ui/separator";
import { SidebarTrigger } from "../ui/sidebar";

export const BreadcrumbsHeader = ({
  breadcrumbs,
  children,
}: {
  breadcrumbs: {
    name: string;
    href?: string;
  }[];
  children?: ReactNode;
}) => (
  <header className="sticky top-0 z-30 grid grid-cols-2 grid-rows-1 min-h-[3.5rem] h-14 items-center gap-4 border-l-amber-50 bg-background py-2 px-4 truncate">
    <div className="gap-2 flex items-center trunctate">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className=" h-4" />
      <Breadcrumb>
        <BreadcrumbList className="flex-nowrap">
          {breadcrumbs.map((crumb, index) => {
            const key = `${crumb.name}-${crumb.href ?? ""}-${index}`;
            return (
              <React.Fragment key={key}>
                <BreadcrumbItem>
                  {crumb.href ? (
                    <BreadcrumbLink asChild>
                      <Link href={crumb.href} prefetch={false}>
                        {crumb.name}
                      </Link>
                    </BreadcrumbLink>
                  ) : (
                    <BreadcrumbPage className="truncate">{crumb.name}</BreadcrumbPage>
                  )}
                </BreadcrumbItem>
                {index < breadcrumbs.length - 1 && <BreadcrumbSeparator />}
              </React.Fragment>
            );
          })}
        </BreadcrumbList>
      </Breadcrumb>
    </div>
    <div className="ml-auto flex items-center gap-2">{children}</div>
  </header>
);
