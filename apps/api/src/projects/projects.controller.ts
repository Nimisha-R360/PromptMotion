import {
  type CreateProjectRequest,
  CreateProjectRequestSchema,
  type CreateRevisionRequest,
  CreateRevisionRequestSchema,
} from "@promptmotion/shared";
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Logger,
  Param,
  ParseUUIDPipe,
  Post,
} from "@nestjs/common";
import { logJson } from "../common/pipeline-log.js";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { ProjectsService } from "./projects.service.js";

@Controller("projects")
export class ProjectsController {
  private readonly logger = new Logger(ProjectsController.name);

  constructor(private readonly projects: ProjectsService) {}

  /** Start a video from a prompt. 202: the plan is written in the background. */
  @Post()
  @HttpCode(202)
  async create(
    @Body(new ZodValidationPipe(CreateProjectRequestSchema)) body: CreateProjectRequest,
  ) {
    logJson(this.logger, "① POST /projects ← request body", body);
    return this.projects.create(body.prompt);
  }

  @Get(":id")
  async get(@Param("id", new ParseUUIDPipe()) id: string) {
    return this.projects.get(id);
  }

  /** Ask for changes to the current plan. 202: the new version is written in the background. */
  @Post(":id/revisions")
  @HttpCode(202)
  async revise(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(CreateRevisionRequestSchema)) body: CreateRevisionRequest,
  ) {
    logJson(this.logger, `R1 POST /projects/${id}/revisions ← feedback`, body);
    return this.projects.revise(id, body.feedback);
  }
}
