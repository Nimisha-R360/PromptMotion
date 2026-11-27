import { ChevronDown, Clapperboard, Download, Globe, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { Project } from "@backend/lib/types";

/** Header Export button: the video or the web page as one HTML file, approved slides only or a draft. */
export function ExportMenu({ project }: { project: Project }) {
  const designed = project.slides.filter((s) => s.spec).length;
  const approved = project.slides.filter((s) => s.status === "approved").length;
  const base = `/api/projects/${project.id}`;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" disabled={!designed}>
          <Download /> Export <ChevronDown className="opacity-70" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel className="text-xs text-muted-foreground">Video</DropdownMenuLabel>
        <DropdownMenuItem asChild disabled={!approved}>
          <a href={`${base}/export`} download>
            <Download /> Approved slides ({approved}) · .html
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a href={`${base}/export?draft=1`} download>
            <Clapperboard /> Draft, with slides in review ({designed})
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a href={`${base}/preview?scope=all`} target="_blank" rel="noreferrer">
            <Play /> Open the video in a new tab
          </a>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-xs text-muted-foreground">Web page</DropdownMenuLabel>
        <DropdownMenuItem asChild disabled={!approved}>
          <a href={`${base}/export?format=web`} download>
            <Globe /> Approved slides ({approved}) · .html
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a href={`${base}/export?format=web&draft=1`} download>
            <Globe /> Draft, with slides in review ({designed})
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a href={`${base}/preview?scope=all&format=web`} target="_blank" rel="noreferrer">
            <Play /> Open the web page in a new tab
          </a>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
