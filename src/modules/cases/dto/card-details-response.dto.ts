import { ApiProperty } from '@nestjs/swagger';

export class CardDetailsResponseDto {
  @ApiProperty({
    description: 'Secure iframe URL for displaying card details (PAN delegation)',
    example:
      'https://airwallex.com/issuing/pci/v2/75c89b87-eb15-453a-85d7-621c104f707d/details#...',
  })
  iframeUrl: string;

  @ApiProperty({
    description: 'PAN token (for reference, token is also embedded in iframe URL)',
    example:
      '1HxHDfKJNnITGTULgnNoAADkgE1q+tMecRMVnk0w5LbpuqXeYdytS/EorRNvJZAFftjQCse6+0UPJNe+dzDwfZv+lxuLt06Blc59BSZkwRx1kIMwtkvPmam7PZNf8ZQvOEfTv6+5Cei/jkjUpivhRA4THHc2hX2gpDSIr/mljHhKXMkKxQU+F7USo2x52cNslYhQVl04U5PYdUbnygJnFtmE+Fd3ENy+HHfkErCCTOTcVzwRRA==',
  })
  token: string;

  @ApiProperty({
    description: 'Token expiration timestamp (ISO 8601)',
    example: '2021-03-22T00:29:34.558+0000',
  })
  expiresAt: string;

  @ApiProperty({
    description: 'Airwallex card ID',
    example: '75c89b87-eb15-453a-85d7-621c104f707d',
  })
  cardId: string;
}
