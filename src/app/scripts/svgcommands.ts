import { Point, Matrix } from './mathutil';
import * as MathUtil from './mathutil';
import * as SvgUtil from './svgutil';

export interface Command {
  isMorphableWith<T extends Command>(command: T): boolean;
  interpolate<T extends Command>(start: T, end: T, fraction: number): boolean;
  transform(transforms: Matrix[]): void;
  execute(ctx: CanvasRenderingContext2D): void;
}

export abstract class PathCommand implements Command {
  protected commands_: SubPathCommand[] = [];

  get commands() {
    return this.commands_;
  }

  isMorphableWith(command: PathCommand) {
    return this.commands_.length === command.commands_.length
      && this.commands_.every((c, i) => c.isMorphableWith(command.commands_[i]));
  }

  interpolate(start: PathCommand, end: PathCommand, fraction: number) {
    if (!this.isMorphableWith(start) || !this.isMorphableWith(end)) {
      return false;
    }
    this.commands_.forEach((c, i) =>
      c.interpolate(start.commands_[i], end.commands_[i], fraction));
    return true;
  }

  transform(transforms: Matrix[]) {
    this.commands_.forEach(c => c.transform(transforms));
  }

  execute(ctx: CanvasRenderingContext2D) {
    ctx.beginPath();
    this.commands_.forEach(c => c.execute(ctx));
  }
}

export class SubPathCommand implements Command {
  private commands_: DrawCommand[];

  constructor(...commands: DrawCommand[]) {
    this.commands_ = commands;
  }

  isMorphableWith(command: SubPathCommand) {
    return this.commands.length === command.commands.length
      && this.commands.every((c, i) => c.isMorphableWith(command.commands[i]));
  }

  interpolate(start: SubPathCommand, end: SubPathCommand, fraction: number) {
    if (!this.isMorphableWith(start) || !this.isMorphableWith(end)) {
      return false;
    }
    this.commands.forEach((c, i) =>
      this.commands[i].interpolate(start.commands[i], end.commands[i], fraction));
    return true;
  }

  transform(transforms: Matrix[]) {
    this.commands.forEach(c => c.transform(transforms));
  }

  execute(ctx: CanvasRenderingContext2D) {
    this.commands.forEach(c => c.execute(ctx));
  }

  get commands() {
    return this.commands_;
  }

  get start() {
    return this.commands[0].end;
  }

  get end() {
    return this.commands[this.commands.length - 1].end;
  }

  isClosed() {
    return this.start.x === this.end.x && this.start.y === this.end.y;
  }

  // TODO(alockwood): add a test for commands with multiple moves but no close paths
  reverse() {
    const firstMoveCommand = this.commands[0];
    if (this.commands.length === 1) {
      firstMoveCommand.reverse();
      return;
    }
    const cmds: DrawCommand[] = this.commands;
    const newCmds: DrawCommand[] = [
      new MoveCommand(firstMoveCommand.start, cmds[cmds.length - 1].end)
    ];
    for (let i = cmds.length - 1; i >= 1; i--) {
      cmds[i].reverse();
      newCmds.push(cmds[i]);
    }
    const secondCmd = newCmds[1];
    if (secondCmd instanceof ClosePathCommand) {
      newCmds[1] = new LineCommand(secondCmd.start, secondCmd.end);
      const lastCmd = newCmds[newCmds.length - 1];
      newCmds[newCmds.length - 1] =
        new ClosePathCommand(lastCmd.start, lastCmd.end);
    }
    this.commands_ = newCmds;
  }

  // TODO(alockwood): add a test for commands with multiple moves but no close paths
  shiftForward() {
    if (this.commands.length === 1 || !this.isClosed()) {
      return;
    }

    // TODO(alockwood): make this more efficient... :P
    for (let i = 0; i < this.commands.length - 2; i++) {
      this.shiftBack();
    }
  }

  // TODO(alockwood): add a test for commands with multiple moves but no close paths
  shiftBack() {
    if (this.commands.length === 1 || !this.isClosed()) {
      return;
    }

    const newCmdLists: DrawCommand[][] = [];
    const cmds = this.commands;
    const moveStartPoint = cmds[0].start;
    cmds.unshift(cmds.pop());

    if (cmds[0] instanceof ClosePathCommand) {
      const lastCmd = cmds[cmds.length - 1];
      cmds[cmds.length - 1] = new ClosePathCommand(lastCmd.start, lastCmd.end);
      cmds[1] = new LineCommand(cmds[0].start, cmds[0].end);
    } else {
      cmds[1] = cmds[0];
    }
    // TODO(alockwood): confirm that this start point is correct for paths w/ multiple moves
    cmds[0] = new MoveCommand(moveStartPoint, cmds[1].start);
  }
}

export abstract class DrawCommand implements Command {
  private readonly svgChar_: string;
  private readonly points_: Point[];

  protected constructor(svgChar: string, ...points: Point[]) {
    this.svgChar_ = svgChar;
    this.points_ = points;
  }

  isMorphableWith(command: DrawCommand) {
    return this.constructor === command.constructor
      && this.points.length === command.points.length;
  }

  interpolate<T extends DrawCommand>(start: T, end: T, fraction: number) {
    if (!this.isMorphableWith(start) || !this.isMorphableWith(end)) {
      return false;
    }
    for (let i = 0; i < start.points.length; i++) {
      const startPoint = start.points[i];
      const endPoint = end.points[i];
      if (startPoint && endPoint) {
        const x = lerp(startPoint.x, endPoint.x, fraction);
        const y = lerp(startPoint.y, endPoint.y, fraction);
        this.points[i] = new Point(x, y);
      }
    }
    return true;
  }

  transform(transforms: Matrix[]) {
    for (let i = 0; i < this.points.length; i++) {
      if (this.points[i]) {
        this.points[i] = MathUtil.transform(this.points[i], ...transforms);
      }
    }
  }

  abstract execute(ctx: CanvasRenderingContext2D): void;

  reverse() {
    if (this.start) {
      // Only reverse the command if it has a valid start point (i.e. if it isn't
      // the first move command in the path).
      this.points.reverse();
    }
  }

  get svgChar() {
    return this.svgChar_;
  }

  get points() {
    return this.points_;
  }

  get start() {
    return this.points_[0];
  }

  get end() {
    return this.points_[this.points_.length - 1];
  }
}

export class MoveCommand extends DrawCommand {
  constructor(start: Point, end: Point) {
    super('M', start, end);
  }

  execute(ctx: CanvasRenderingContext2D) {
    ctx.moveTo(this.end.x, this.end.y);
  }
}

export class LineCommand extends DrawCommand {
  constructor(start: Point, end: Point) {
    super('L', start, end);
  }

  execute(ctx: CanvasRenderingContext2D) {
    ctx.lineTo(this.end.x, this.end.y);
  }
}

export class QuadraticCurveCommand extends DrawCommand {
  constructor(start: Point, cp: Point, end: Point) {
    super('Q', start, cp, end);
  }

  execute(ctx: CanvasRenderingContext2D) {
    ctx.quadraticCurveTo(
      this.points[1].x, this.points[1].y,
      this.points[2].x, this.points[2].y);
  }
}

export class BezierCurveCommand extends DrawCommand {
  constructor(start: Point, cp1: Point, cp2: Point, end: Point) {
    super('C', start, cp1, cp2, end);
  }

  execute(ctx: CanvasRenderingContext2D) {
    ctx.bezierCurveTo(
      this.points[1].x, this.points[1].y,
      this.points[2].x, this.points[2].y,
      this.points[3].x, this.points[3].y);
  }
}

export class ClosePathCommand extends DrawCommand {
  constructor(start: Point, end: Point) {
    super('Z', start, end);
  }

  execute(ctx: CanvasRenderingContext2D) {
    ctx.closePath();
  }
}

// TODO(alockwood): figure out what to do with elliptical arcs
export class EllipticalArcCommand extends DrawCommand {
  readonly args: number[];

  constructor(...args: number[]) {
    super('A', new Point(args[0], args[1]), new Point(args[7], args[8]));
    this.args = args;
  }

  isMorphableWith(command: EllipticalArcCommand) {
    return true;
  }

  // TODO(alockwood): confirm this is correct?
  interpolate(start: EllipticalArcCommand, end: EllipticalArcCommand, fraction: number) {
    this.args.forEach((_, i) => {
      if (i === 5 || i === 6) {
        // Doesn't make sense to interpolate the large arc and sweep flags.
        this.args[i] = fraction === 0 ? start.args[i] : end.args[i];
        return;
      }
      this.args[i] = lerp(start.args[i], end.args[i], fraction);
    });
    return true;
  }

  transform(transforms: Matrix[]) {
    const start = MathUtil.transform(
      { x: this.args[0], y: this.args[1] }, ...transforms);
    this.args[0] = start.x;
    this.args[1] = start.y;
    const arc = SvgUtil.transformArc({
      rx: this.args[2],
      ry: this.args[3],
      xAxisRotation: this.args[4],
      largeArcFlag: this.args[5],
      sweepFlag: this.args[6],
      endX: this.args[7],
      endY: this.args[8],
    }, transforms);
    this.args[2] = arc.rx;
    this.args[3] = arc.ry;
    this.args[4] = arc.xAxisRotation;
    this.args[5] = arc.largeArcFlag;
    this.args[6] = arc.sweepFlag;
    this.args[7] = arc.endX;
    this.args[8] = arc.endY;
  }

  execute(ctx: CanvasRenderingContext2D) {
    SvgUtil.executeArc(ctx, this.args);
  }

  reverse() {
    const endX = this.args[0];
    const endY = this.args[1];
    this.args[0] = this.args[7];
    this.args[1] = this.args[8];
    this.args[6] = this.args[6] === 0 ? 1 : 0;
    this.args[7] = endX;
    this.args[8] = endY;
  }
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}
