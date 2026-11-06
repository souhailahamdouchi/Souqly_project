<?php

namespace App\Enums;

enum VendorStatus: string
{
    case EN_ATTENTE = 'EN_ATTENTE';
    case APPROUVE = 'APPROUVE';
    case SUSPENDU = 'SUSPENDU';
}
