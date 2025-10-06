import { ApiProperty } from '@nestjs/swagger';

export class UserData {
  @ApiProperty()
  cd_code: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  email: string;

  @ApiProperty()
  username: string;

  @ApiProperty()
  broker_user_name: string;

  @ApiProperty()
  participant_code: string;

  @ApiProperty()
  profilePicture: string | null;

  @ApiProperty()
  isNRB: number;

  @ApiProperty()
  cid: string;
}

export class LoginResponseDto {
  @ApiProperty()
  error: boolean;

  @ApiProperty()
  message: string;

  @ApiProperty({ type: UserData, required: false })
  data?: UserData | null;

  @ApiProperty({ required: false })
  access_token?: string;

  @ApiProperty({ required: false })
  refresh_token?: string;
}

