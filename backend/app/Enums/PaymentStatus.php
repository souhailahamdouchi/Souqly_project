<?php

namespace App\Enums;

enum PaymentStatus: string
{
    case EN_ATTENTE = 'EN_ATTENTE';
    case PAYE = 'PAYE';
    case ECHOUE = 'ECHOUE';
    case REMBOURSE = 'REMBOURSE';
}
