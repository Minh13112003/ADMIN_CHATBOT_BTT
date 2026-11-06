import { Global, Module } from '@nestjs/common';
import { AttachmentsService } from './attachments.service';
import { FilesController } from './files.controller';
import { StorageService } from './storage.service';

@Global()
@Module({
  controllers: [FilesController],
  providers: [StorageService, AttachmentsService],
  exports: [StorageService, AttachmentsService],
})
export class StorageModule {}
