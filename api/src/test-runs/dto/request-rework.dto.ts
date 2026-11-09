import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RequestReworkDto {
  @ApiProperty({ description: 'Lý do yêu cầu làm lại đợt kiểm thử' })
  @IsNotEmpty({ message: 'Vui lòng nhập lý do yêu cầu làm lại' })
  @IsString()
  @MaxLength(500, { message: 'Lý do tối đa 500 ký tự' })
  reason: string;
}
